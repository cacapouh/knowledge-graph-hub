"""
Graph backup service.

Uses SQLite's built-in backup API for safe, consistent snapshots of the database
while it is actively being used.  Backups are stored in a configurable directory
(default: ``backups/`` next to the database file).
"""

import logging
import os
import sqlite3
import time
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, func as sa_func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.backup import GraphBackup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

MAX_BACKUPS = 50  # keep the latest N backups, auto-prune older ones
MIN_INTERVAL_SECONDS = 5  # debounce: skip if last backup was < N seconds ago

_last_backup_ts: float = 0.0  # monotonic clock of last successful backup


def _db_path() -> Path:
    """Return the resolved filesystem path of the SQLite database."""
    url = get_settings().database_url
    # "sqlite+aiosqlite:///./kghub.db" → "./kghub.db"
    path_str = url.split("///", 1)[-1]
    return Path(path_str).resolve()


def _backup_dir() -> Path:
    """Return (and ensure) the backup directory."""
    d = _db_path().parent / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# Core: create backup using sqlite3.backup()
# ---------------------------------------------------------------------------

def _create_backup_file(change_type: str) -> tuple[str, int]:
    """
    Synchronously create a backup of the SQLite database.

    Returns (filename, size_bytes).
    """
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"kghub_backup_{ts}_{change_type}.db"
    dest_path = _backup_dir() / filename

    src_path = str(_db_path())

    # Use the sqlite3 backup API for a consistent snapshot
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(str(dest_path))
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()

    size_bytes = dest_path.stat().st_size
    logger.info("Backup created: %s (%d bytes)", filename, size_bytes)
    return filename, size_bytes


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def create_backup(
    db: AsyncSession,
    change_type: str,
    description: str = "",
    *,
    respect_debounce: bool = True,
) -> GraphBackup | None:
    """
    Create a new graph backup.

    If ``respect_debounce`` is True the backup is silently skipped when the
    last backup was created less than ``MIN_INTERVAL_SECONDS`` ago.
    """
    global _last_backup_ts

    if respect_debounce:
        now = time.monotonic()
        if now - _last_backup_ts < MIN_INTERVAL_SECONDS:
            logger.debug("Backup skipped (debounce)")
            return None

    try:
        filename, size_bytes = _create_backup_file(change_type)
    except Exception:
        logger.exception("Failed to create backup file")
        return None

    _last_backup_ts = time.monotonic()

    record = GraphBackup(
        filename=filename,
        change_type=change_type,
        description=description,
        size_bytes=size_bytes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    # Auto-prune old backups
    await _prune_old_backups(db)

    return record


async def list_backups(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> list[GraphBackup]:
    result = await db.execute(
        select(GraphBackup)
        .order_by(GraphBackup.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_backup(db: AsyncSession, backup_id: int) -> GraphBackup | None:
    result = await db.execute(
        select(GraphBackup).where(GraphBackup.id == backup_id)
    )
    return result.scalar_one_or_none()


async def delete_backup(db: AsyncSession, backup_id: int) -> bool:
    record = await get_backup(db, backup_id)
    if not record:
        return False
    # Remove file
    fpath = _backup_dir() / record.filename
    if fpath.exists():
        fpath.unlink()
    await db.delete(record)
    return True


async def restore_backup(db: AsyncSession, backup_id: int) -> bool:
    """
    Restore the database from a backup.

    **WARNING**: This replaces the current database file.  The caller should
    restart the application / reload the engine after calling this.
    """
    record = await get_backup(db, backup_id)
    if not record:
        return False

    fpath = _backup_dir() / record.filename
    if not fpath.exists():
        return False

    db_path = str(_db_path())

    # First, create a safety backup of the current state
    try:
        _create_backup_file("pre_restore")
    except Exception:
        logger.exception("Failed to create pre-restore safety backup")

    # Use the sqlite3 backup API in reverse
    src = sqlite3.connect(str(fpath))
    dst = sqlite3.connect(db_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()

    logger.info("Database restored from backup: %s", record.filename)
    return True


async def backup_count(db: AsyncSession) -> int:
    result = await db.execute(select(sa_func.count(GraphBackup.id)))
    return result.scalar() or 0


async def _prune_old_backups(db: AsyncSession) -> None:
    """Remove the oldest backups beyond MAX_BACKUPS."""
    count = await backup_count(db)
    if count <= MAX_BACKUPS:
        return

    # Get IDs to delete (oldest first)
    to_delete_count = count - MAX_BACKUPS
    result = await db.execute(
        select(GraphBackup)
        .order_by(GraphBackup.created_at.asc())
        .limit(to_delete_count)
    )
    old_backups = result.scalars().all()
    for b in old_backups:
        fpath = _backup_dir() / b.filename
        if fpath.exists():
            fpath.unlink()
        await db.delete(b)
    logger.info("Pruned %d old backups", len(old_backups))

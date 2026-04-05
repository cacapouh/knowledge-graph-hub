"""
Graph backup service.

Uses ``pg_dump`` / ``pg_restore`` for safe, consistent snapshots of the
PostgreSQL database while it is actively being used.  Backups are stored
in a configurable directory (default: ``backups/`` relative to the working
directory).
"""

import asyncio
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

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


def _parse_pg_url() -> dict[str, str]:
    """Parse DATABASE_URL into components usable by pg_dump / pg_restore."""
    url = get_settings().database_url
    # Convert SQLAlchemy URL to a standard postgresql:// URL
    raw = url.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(raw)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "kghub",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/") or "kghub",
    }


def _backup_dir() -> Path:
    """Return (and ensure) the backup directory."""
    d = Path("backups")
    d.mkdir(parents=True, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# Core: create backup using pg_dump
# ---------------------------------------------------------------------------

async def _create_backup_file(change_type: str) -> tuple[str, int]:
    """
    Create a backup of the PostgreSQL database using pg_dump.

    Returns (filename, size_bytes).
    """
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"kghub_backup_{ts}_{change_type}.dump"
    dest_path = _backup_dir() / filename

    pg = _parse_pg_url()
    env = {**os.environ, "PGPASSWORD": pg["password"]}

    proc = await asyncio.create_subprocess_exec(
        "pg_dump",
        "-h", pg["host"],
        "-p", pg["port"],
        "-U", pg["user"],
        "-d", pg["dbname"],
        "-Fc",  # custom format (compressed, supports pg_restore)
        "-f", str(dest_path),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {stderr.decode()}")

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
        filename, size_bytes = await _create_backup_file(change_type)
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
    Restore the database from a backup using pg_restore.

    **WARNING**: This replaces the current database contents.  The caller
    should restart the application / reload the engine after calling this.
    """
    record = await get_backup(db, backup_id)
    if not record:
        return False

    fpath = _backup_dir() / record.filename
    if not fpath.exists():
        return False

    # First, create a safety backup of the current state
    try:
        await _create_backup_file("pre_restore")
    except Exception:
        logger.exception("Failed to create pre-restore safety backup")

    pg = _parse_pg_url()
    env = {**os.environ, "PGPASSWORD": pg["password"]}

    proc = await asyncio.create_subprocess_exec(
        "pg_restore",
        "-h", pg["host"],
        "-p", pg["port"],
        "-U", pg["user"],
        "-d", pg["dbname"],
        "--clean",       # drop existing objects before restoring
        "--if-exists",   # don't error if objects don't exist yet
        str(fpath),
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        err = stderr.decode()
        # pg_restore returns non-zero for warnings too; log but don't fail
        logger.warning("pg_restore finished with warnings: %s", err)

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

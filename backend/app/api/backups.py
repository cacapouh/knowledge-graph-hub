from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.backup import GraphBackupResponse, GraphBackupCreate
from app.services.backup import (
    create_backup,
    list_backups,
    get_backup,
    delete_backup,
    restore_backup,
    backup_count,
)

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("", response_model=list[GraphBackupResponse])
async def list_graph_backups(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List all graph backups, newest first."""
    return await list_backups(db, skip=skip, limit=limit)


@router.get("/count")
async def get_backup_count(db: AsyncSession = Depends(get_db)):
    """Get total number of backups."""
    count = await backup_count(db)
    return {"count": count}


@router.post("", response_model=GraphBackupResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_backup(
    data: GraphBackupCreate | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Manually create a graph backup."""
    desc = data.description if data else ""
    record = await create_backup(db, change_type="manual", description=desc, respect_debounce=False)
    if not record:
        raise HTTPException(status_code=500, detail="Failed to create backup")
    return record


@router.post("/{backup_id}/restore")
async def restore_graph_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Restore the database from a specific backup.

    A safety backup of the current state is created first.
    After restore the application should be restarted for full consistency.
    """
    success = await restore_backup(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="Backup not found or file missing")
    return {"status": "restored", "message": "Database restored. Restart recommended."}


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_graph_backup(
    backup_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific backup."""
    success = await delete_backup(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="Backup not found")

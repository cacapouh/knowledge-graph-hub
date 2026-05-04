"""Graph Pull Request API.

A GPR is a batch of proposed graph mutations. Phase 1:
  POST   /api/gpr                — create (auto_merge=true applies immediately)
  GET    /api/gpr                — list (newest first), optional ?status=
  GET    /api/gpr/{id}           — detail
  POST   /api/gpr/{id}/apply     — apply an open GPR (≒ approve in Approve-mode)
  POST   /api/gpr/{id}/close     — close an open GPR without applying (reject)
  POST   /api/gpr/{id}/revert    — undo a merged GPR via inverse_ops
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.gpr import GraphPullRequest
from app.schemas.gpr import GPRCreate, GPRResponse
from app.services.gpr_apply import apply_operations, GPRApplyError, now_utc

router = APIRouter(prefix="/api/gpr", tags=["gpr"])


@router.post("", response_model=GPRResponse, status_code=http_status.HTTP_201_CREATED)
async def create_gpr(data: GPRCreate, db: AsyncSession = Depends(get_db)):
    gpr = GraphPullRequest(
        title=data.title,
        description=data.description,
        source=data.source,
        auto_merge=data.auto_merge,
        operations=data.operations,
        status="open",
        apply_log=[],
        inverse_ops=[],
    )
    db.add(gpr)
    await db.flush()
    await db.refresh(gpr)

    if data.auto_merge:
        try:
            apply_log, inverse_ops = await apply_operations(db, data.operations)
        except GPRApplyError as e:
            gpr.status = "failed"
            gpr.apply_log = e.apply_log
            await db.flush()
            await db.refresh(gpr)
            return gpr
        gpr.status = "merged"
        gpr.apply_log = apply_log
        gpr.inverse_ops = inverse_ops
        gpr.applied_at = now_utc()
        await db.flush()
        await db.refresh(gpr)

    return gpr


@router.get("", response_model=list[GPRResponse])
async def list_gpr(
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(GraphPullRequest).order_by(GraphPullRequest.created_at.desc()).limit(limit)
    if status:
        query = query.where(GraphPullRequest.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{gpr_id}", response_model=GPRResponse)
async def get_gpr(gpr_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GraphPullRequest).where(GraphPullRequest.id == gpr_id))
    gpr = result.scalar_one_or_none()
    if not gpr:
        raise HTTPException(404, "GPR not found")
    return gpr


@router.post("/{gpr_id}/apply", response_model=GPRResponse)
async def apply_gpr(gpr_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GraphPullRequest).where(GraphPullRequest.id == gpr_id))
    gpr = result.scalar_one_or_none()
    if not gpr:
        raise HTTPException(404, "GPR not found")
    if gpr.status != "open":
        raise HTTPException(400, f"GPR is {gpr.status}, expected open")

    try:
        apply_log, inverse_ops = await apply_operations(db, gpr.operations)
    except GPRApplyError as e:
        gpr.status = "failed"
        gpr.apply_log = e.apply_log
        await db.flush()
        await db.refresh(gpr)
        return gpr

    gpr.status = "merged"
    gpr.apply_log = apply_log
    gpr.inverse_ops = inverse_ops
    gpr.applied_at = now_utc()
    await db.flush()
    await db.refresh(gpr)
    return gpr


@router.post("/{gpr_id}/close", response_model=GPRResponse)
async def close_gpr(gpr_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GraphPullRequest).where(GraphPullRequest.id == gpr_id))
    gpr = result.scalar_one_or_none()
    if not gpr:
        raise HTTPException(404, "GPR not found")
    if gpr.status != "open":
        raise HTTPException(400, f"GPR is {gpr.status}, expected open")
    gpr.status = "closed"
    await db.flush()
    await db.refresh(gpr)
    return gpr


@router.post("/{gpr_id}/revert", response_model=GPRResponse)
async def revert_gpr(gpr_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GraphPullRequest).where(GraphPullRequest.id == gpr_id))
    gpr = result.scalar_one_or_none()
    if not gpr:
        raise HTTPException(404, "GPR not found")
    if gpr.status != "merged":
        raise HTTPException(400, f"GPR is {gpr.status}, expected merged")

    try:
        revert_log, _ = await apply_operations(db, gpr.inverse_ops)
    except GPRApplyError as e:
        # Revert itself failed. Keep status=merged so the user/AI can retry.
        raise HTTPException(
            500,
            detail={"message": "revert failed", "apply_log": e.apply_log},
        )

    gpr.status = "reverted"
    # Preserve original apply_log; append the revert trace for diagnosability.
    gpr.apply_log = list(gpr.apply_log) + [{"revert_log": revert_log}]
    await db.flush()
    await db.refresh(gpr)
    return gpr

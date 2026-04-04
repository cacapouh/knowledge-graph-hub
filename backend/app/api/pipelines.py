from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pipeline import Pipeline, PipelineStep, PipelineRun, RunStatus
from app.schemas.pipeline import (
    PipelineCreate, PipelineUpdate, PipelineResponse,
    PipelineStepCreate, PipelineStepResponse,
    PipelineRunResponse,
)

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("", response_model=list[PipelineResponse])
async def list_pipelines(
    project_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Pipeline).order_by(Pipeline.created_at.desc())
    if project_id is not None:
        query = query.where(Pipeline.project_id == project_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    data: PipelineCreate,
    db: AsyncSession = Depends(get_db),
):
    pipeline = Pipeline(**data.model_dump())
    db.add(pipeline)
    await db.flush()
    await db.refresh(pipeline)
    return pipeline


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(
    pipeline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.patch("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: int,
    data: PipelineUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pipeline, field, value)
    await db.flush()
    await db.refresh(pipeline)
    return pipeline


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(
    pipeline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await db.delete(pipeline)


# --- Steps ---

@router.get("/{pipeline_id}/steps", response_model=list[PipelineStepResponse])
async def list_pipeline_steps(
    pipeline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PipelineStep)
        .where(PipelineStep.pipeline_id == pipeline_id)
        .order_by(PipelineStep.step_order)
    )
    return result.scalars().all()


@router.post("/{pipeline_id}/steps", response_model=PipelineStepResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline_step(
    pipeline_id: int,
    data: PipelineStepCreate,
    db: AsyncSession = Depends(get_db),
):
    step = PipelineStep(**data.model_dump())
    step.pipeline_id = pipeline_id
    db.add(step)
    await db.flush()
    await db.refresh(step)
    return step


# --- Runs ---

@router.get("/{pipeline_id}/runs", response_model=list[PipelineRunResponse])
async def list_pipeline_runs(
    pipeline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.pipeline_id == pipeline_id)
        .order_by(PipelineRun.started_at.desc())
    )
    return result.scalars().all()


@router.post("/{pipeline_id}/run", response_model=PipelineRunResponse, status_code=status.HTTP_201_CREATED)
async def trigger_pipeline_run(
    pipeline_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    run = PipelineRun(
        pipeline_id=pipeline_id,
        status=RunStatus.PENDING,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    # TODO: Dispatch actual pipeline execution to background worker
    return run

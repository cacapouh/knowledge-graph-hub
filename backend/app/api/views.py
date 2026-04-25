from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.saved_view import SavedView

router = APIRouter(prefix="/api/views", tags=["views"])


# --- Schemas ---

class SavedViewCreate(BaseModel):
    name: str
    description: str = ""
    object_type_ids: list[int] = []
    link_type_ids: list[int] = []


class SavedViewUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    object_type_ids: list[int] | None = None
    link_type_ids: list[int] | None = None


class SavedViewResponse(BaseModel):
    id: int
    name: str
    description: str
    object_type_ids: list[int]
    link_type_ids: list[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Endpoints ---

@router.get("", response_model=list[SavedViewResponse])
async def list_views(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).order_by(SavedView.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=SavedViewResponse, status_code=201)
async def create_view(data: SavedViewCreate, db: AsyncSession = Depends(get_db)):
    view = SavedView(
        name=data.name,
        description=data.description,
        object_type_ids=data.object_type_ids,
        link_type_ids=data.link_type_ids,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return view


@router.get("/{view_id}", response_model=SavedViewResponse)
async def get_view(view_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    return view


@router.put("/{view_id}", response_model=SavedViewResponse)
async def update_view(view_id: int, data: SavedViewUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    if data.name is not None:
        view.name = data.name
    if data.description is not None:
        view.description = data.description
    if data.object_type_ids is not None:
        view.object_type_ids = data.object_type_ids
    if data.link_type_ids is not None:
        view.link_type_ids = data.link_type_ids
    await db.commit()
    await db.refresh(view)
    return view


@router.delete("/{view_id}", status_code=204)
async def delete_view(view_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    await db.delete(view)
    await db.commit()

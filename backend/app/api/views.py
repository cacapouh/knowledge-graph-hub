from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Annotated, Literal, Union

from app.database import get_db
from app.models.saved_view import SavedView

router = APIRouter(prefix="/api/views", tags=["views"])


# --- Condition schemas ---
# A View has an ordered list of conditions. The visible subgraph is the
# union (OR) of each condition's selection. See SavedView.conditions docstring.

class TypeFilterCondition(BaseModel):
    """Show all nodes of the given types and all edges of the given types."""
    kind: Literal["type_filter"] = "type_filter"
    object_type_ids: list[int] = Field(default_factory=list)
    link_type_ids: list[int] = Field(default_factory=list)


class NeighborhoodOfTypeCondition(BaseModel):
    """BFS distance N starting from every instance of the given node type."""
    kind: Literal["neighborhood_of_type"] = "neighborhood_of_type"
    object_type_id: int
    distance: int = Field(default=1, ge=1, le=5)


class NeighborhoodOfIdsCondition(BaseModel):
    """BFS distance N starting from the given node IDs."""
    kind: Literal["neighborhood_of_ids"] = "neighborhood_of_ids"
    object_ids: list[int] = Field(default_factory=list)
    distance: int = Field(default=1, ge=1, le=5)


class ExcludeTypesCondition(BaseModel):
    """Subtract nodes of the given object types and links of the given link types
    from the OR-combined selection. If only exclude conditions are present, the
    baseline is the full graph (i.e. "everything except these types").
    """
    kind: Literal["exclude_types"] = "exclude_types"
    object_type_ids: list[int] = Field(default_factory=list)
    link_type_ids: list[int] = Field(default_factory=list)


Condition = Annotated[
    Union[
        TypeFilterCondition,
        NeighborhoodOfTypeCondition,
        NeighborhoodOfIdsCondition,
        ExcludeTypesCondition,
    ],
    Field(discriminator="kind"),
]


# --- Request / response schemas ---

class SavedViewCreate(BaseModel):
    name: str
    description: str = ""
    conditions: list[Condition] = Field(default_factory=list)
    # Legacy fields — accepted on create for backward compatibility. If
    # `conditions` is empty and legacy fields are non-empty, we synthesize a
    # single type_filter condition.
    object_type_ids: list[int] | None = None
    link_type_ids: list[int] | None = None

    @model_validator(mode="after")
    def _backfill_legacy(self) -> "SavedViewCreate":
        if not self.conditions and (self.object_type_ids or self.link_type_ids):
            self.conditions = [
                TypeFilterCondition(
                    object_type_ids=self.object_type_ids or [],
                    link_type_ids=self.link_type_ids or [],
                )
            ]
        return self


class SavedViewUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    conditions: list[Condition] | None = None
    # Legacy fields — kept so old clients can still update by type filter only.
    object_type_ids: list[int] | None = None
    link_type_ids: list[int] | None = None


class SavedViewResponse(BaseModel):
    id: int
    name: str
    description: str
    conditions: list[Condition]
    # Mirrored legacy fields so existing clients (URL builders, MCP) keep working.
    object_type_ids: list[int]
    link_type_ids: list[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Helpers ---

def _conditions_to_legacy(conditions: list[dict]) -> tuple[list[int], list[int]]:
    """Mirror the first type_filter condition into legacy object/link type id arrays."""
    for cond in conditions or []:
        if isinstance(cond, dict) and cond.get("kind") == "type_filter":
            return (
                list(cond.get("object_type_ids") or []),
                list(cond.get("link_type_ids") or []),
            )
    return ([], [])


def _serialize(view: SavedView) -> dict:
    conditions = list(view.conditions or [])
    obj_ids, link_ids = _conditions_to_legacy(conditions)
    # Prefer the columns we actually persisted, falling back to mirrored values.
    return {
        "id": view.id,
        "name": view.name,
        "description": view.description or "",
        "conditions": conditions,
        "object_type_ids": list(view.object_type_ids or []) or obj_ids,
        "link_type_ids": list(view.link_type_ids or []) or link_ids,
        "created_at": view.created_at,
        "updated_at": view.updated_at,
    }


# --- Endpoints ---

@router.get("", response_model=list[SavedViewResponse])
async def list_views(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).order_by(SavedView.updated_at.desc()))
    return [_serialize(v) for v in result.scalars().all()]


@router.post("", response_model=SavedViewResponse, status_code=201)
async def create_view(data: SavedViewCreate, db: AsyncSession = Depends(get_db)):
    conditions = [c.model_dump() for c in data.conditions]
    obj_ids, link_ids = _conditions_to_legacy(conditions)
    view = SavedView(
        name=data.name,
        description=data.description,
        conditions=conditions,
        object_type_ids=obj_ids,
        link_type_ids=link_ids,
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return _serialize(view)


@router.get("/{view_id}", response_model=SavedViewResponse)
async def get_view(view_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    return _serialize(view)


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
    if data.conditions is not None:
        conditions = [c.model_dump() for c in data.conditions]
        view.conditions = conditions
        obj_ids, link_ids = _conditions_to_legacy(conditions)
        view.object_type_ids = obj_ids
        view.link_type_ids = link_ids
    else:
        # Legacy update path: only object/link type ids provided
        if data.object_type_ids is not None or data.link_type_ids is not None:
            new_obj = data.object_type_ids if data.object_type_ids is not None else list(view.object_type_ids or [])
            new_link = data.link_type_ids if data.link_type_ids is not None else list(view.link_type_ids or [])
            view.object_type_ids = new_obj
            view.link_type_ids = new_link
            view.conditions = [{
                "kind": "type_filter",
                "object_type_ids": new_obj,
                "link_type_ids": new_link,
            }] if (new_obj or new_link) else []
    await db.commit()
    await db.refresh(view)
    return _serialize(view)


@router.delete("/{view_id}", status_code=204)
async def delete_view(view_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id))
    view = result.scalar_one_or_none()
    if not view:
        raise HTTPException(404, "View not found")
    await db.delete(view)
    await db.commit()

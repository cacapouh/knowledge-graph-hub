from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.ontology import (
    ObjectType, PropertyType, LinkType, ActionType, ObjectInstance, LinkInstance,
)
from app.schemas.ontology import (
    ObjectTypeCreate, ObjectTypeUpdate, ObjectTypeResponse,
    PropertyTypeCreate, PropertyTypeResponse,
    LinkTypeCreate, LinkTypeResponse,
    ActionTypeCreate, ActionTypeResponse,
    ObjectInstanceCreate, ObjectInstanceUpdate, ObjectInstanceResponse,
    LinkInstanceCreate, LinkInstanceResponse,
)

router = APIRouter(prefix="/api/ontology", tags=["ontology"])

# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Object Types
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/object-types", response_model=list[ObjectTypeResponse])
async def list_object_types(
    project_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(ObjectType).order_by(ObjectType.name)
    if project_id is not None:
        query = query.where(ObjectType.project_id == project_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/object-types", response_model=ObjectTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_object_type(
    data: ObjectTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    obj = ObjectType(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/object-types/{object_type_id}", response_model=ObjectTypeResponse)
async def get_object_type(
    object_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object type not found")
    return obj


@router.patch("/object-types/{object_type_id}", response_model=ObjectTypeResponse)
async def update_object_type(
    object_type_id: int,
    data: ObjectTypeUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object type not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/object-types/{object_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object_type(
    object_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object type not found")
    await db.delete(obj)


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Property Types
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/object-types/{object_type_id}/properties", response_model=list[PropertyTypeResponse])
async def list_property_types(
    object_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PropertyType)
        .where(PropertyType.object_type_id == object_type_id)
        .order_by(PropertyType.name)
    )
    return result.scalars().all()


@router.post("/properties", response_model=PropertyTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_property_type(
    data: PropertyTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    prop = PropertyType(**data.model_dump())
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    return prop


@router.delete("/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property_type(
    property_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PropertyType).where(PropertyType.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property type not found")
    await db.delete(prop)


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Link Types
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/link-types", response_model=list[LinkTypeResponse])
async def list_link_types(
    project_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(LinkType).order_by(LinkType.name)
    if project_id is not None:
        query = query.where(LinkType.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/link-types", response_model=LinkTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_link_type(
    data: LinkTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    link = LinkType(**data.model_dump())
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


@router.delete("/link-types/{link_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link_type(
    link_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LinkType).where(LinkType.id == link_type_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link type not found")
    await db.delete(link)


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Action Types
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/action-types", response_model=list[ActionTypeResponse])
async def list_action_types(
    project_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ActionType).order_by(ActionType.name)
    if project_id is not None:
        query = query.where(ActionType.project_id == project_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/action-types", response_model=ActionTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_action_type(
    data: ActionTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    action = ActionType(**data.model_dump())
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Object Instances
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/objects", response_model=list[ObjectInstanceResponse])
async def list_objects(
    object_type_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ObjectInstance)
        .where(ObjectInstance.object_type_id == object_type_id)
        .order_by(ObjectInstance.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/objects", response_model=ObjectInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_object(
    data: ObjectInstanceCreate,
    db: AsyncSession = Depends(get_db),
):
    obj = ObjectInstance(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/objects/{object_id}", response_model=ObjectInstanceResponse)
async def get_object(
    object_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    return obj


@router.patch("/objects/{object_id}", response_model=ObjectInstanceResponse)
async def update_object(
    object_id: int,
    data: ObjectInstanceUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    obj.properties = data.properties
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/objects/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object(
    object_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    await db.delete(obj)


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Link Instances
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/objects/{object_id}/links", response_model=list[LinkInstanceResponse])
async def list_object_links(
    object_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LinkInstance).where(
            (LinkInstance.source_object_id == object_id)
            | (LinkInstance.target_object_id == object_id)
        )
    )
    return result.scalars().all()


@router.post("/links", response_model=LinkInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_link(
    data: LinkInstanceCreate,
    db: AsyncSession = Depends(get_db),
):
    link = LinkInstance(**data.model_dump())
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    link_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LinkInstance).where(LinkInstance.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)

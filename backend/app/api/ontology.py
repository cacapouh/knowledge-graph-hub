from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
import re

from app.database import get_db, async_session
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
from pydantic import BaseModel
from app.services.backup import create_backup

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


async def _auto_backup(change_type: str, description: str = "") -> None:
    """Create a backup in a fresh session (called from BackgroundTasks)."""
    async with async_session() as session:
        try:
            await create_backup(session, change_type, description)
            await session.commit()
        except Exception:
            await session.rollback()

# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Object Types
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/object-types", response_model=list[ObjectTypeResponse])
async def list_object_types(
    project_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    obj = ObjectType(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    bg.add_task(_auto_backup, "create_object_type", f"Created object type: {obj.name}")
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
    bg: BackgroundTasks,
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
    bg.add_task(_auto_backup, "update_object_type", f"Updated object type: {obj.name}")
    return obj


@router.delete("/object-types/{object_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object_type(
    object_type_id: int,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object type not found")
    name = obj.name
    await db.delete(obj)
    bg.add_task(_auto_backup, "delete_object_type", f"Deleted object type: {name}")


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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    prop = PropertyType(**data.model_dump())
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    bg.add_task(_auto_backup, "create_property_type", f"Created property: {prop.name}")
    return prop


@router.delete("/properties/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property_type(
    property_id: int,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PropertyType).where(PropertyType.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property type not found")
    name = prop.name
    await db.delete(prop)
    bg.add_task(_auto_backup, "delete_property_type", f"Deleted property: {name}")


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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    link = LinkType(**data.model_dump())
    db.add(link)
    await db.flush()
    await db.refresh(link)
    bg.add_task(_auto_backup, "create_link_type", f"Created link type: {link.name}")
    return link


@router.delete("/link-types/{link_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link_type(
    link_type_id: int,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LinkType).where(LinkType.id == link_type_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link type not found")
    name = link.name
    await db.delete(link)
    bg.add_task(_auto_backup, "delete_link_type", f"Deleted link type: {name}")


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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    action = ActionType(**data.model_dump())
    db.add(action)
    await db.flush()
    await db.refresh(action)
    bg.add_task(_auto_backup, "create_action_type", f"Created action type: {action.name}")
    return action


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Object Instances
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/objects", response_model=list[ObjectInstanceResponse])
async def list_objects(
    object_type_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(ObjectInstance).order_by(ObjectInstance.created_at.desc())
    if object_type_id is not None:
        query = query.where(ObjectInstance.object_type_id == object_type_id)
    query = query.offset(skip)
    if limit > 0:
        query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/objects", response_model=ObjectInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_object(
    data: ObjectInstanceCreate,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    obj = ObjectInstance(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    bg.add_task(_auto_backup, "create_object", f"Created object id={obj.id}")
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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    obj.properties = data.properties
    await db.flush()
    await db.refresh(obj)
    bg.add_task(_auto_backup, "update_object", f"Updated object id={obj.id}")
    return obj


@router.delete("/objects/{object_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_object(
    object_id: int,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    await db.delete(obj)
    bg.add_task(_auto_backup, "delete_object", f"Deleted object id={object_id}")


# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
# Link Instances
# 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏

@router.get("/links", response_model=list[LinkInstanceResponse])
async def list_all_links(
    link_type_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    query = select(LinkInstance).order_by(LinkInstance.id)
    if link_type_id is not None:
        query = query.where(LinkInstance.link_type_id == link_type_id)
    query = query.offset(skip)
    if limit > 0:
        query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


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
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    link = LinkInstance(**data.model_dump())
    db.add(link)
    await db.flush()
    await db.refresh(link)
    bg.add_task(_auto_backup, "create_link", f"Created link id={link.id}")
    return link


@router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    link_id: int,
    bg: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LinkInstance).where(LinkInstance.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)
    bg.add_task(_auto_backup, "delete_link", f"Deleted link id={link_id}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cypher Query
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Simplified Cypher parser
# Supported patterns:
#   MATCH (n:TypeName) RETURN n
#   MATCH (n:TypeName)-[:RelName]->(m:TypeName) RETURN n, r, m
#   MATCH (n:TypeName {key: "value"}) RETURN n
#   MATCH (n:TypeName)-[:RelName]->(m) RETURN n, r, m
#   MATCH (n)-[:RelName]->(m:TypeName) RETURN n, r, m

_NODE_PAT = re.compile(
    r'\(\s*(\w+)\s*(?::\s*(\w+))?\s*(?:\{([^}]*)\})?\s*\)'
)
_REL_PAT = re.compile(
    r'-\[\s*(?:(\w+))?\s*(?::\s*(\w+))?\s*\]->'
)
_MATCH_RE = re.compile(
    r'MATCH\s+(.*?)(?:\s+WHERE\s+(.*?))?\s*(?:RETURN|$)',
    re.IGNORECASE | re.DOTALL,
)
_WHERE_PROP = re.compile(
    r'(\w+)\.(\w+)\s*=\s*["\']([^"\']*)["\']'
)


def _parse_node_props(prop_str: str | None) -> dict[str, str]:
    """Parse {key: "value", key2: "value2"} into dict."""
    if not prop_str:
        return {}
    props = {}
    for m in re.finditer(r'(\w+)\s*:\s*["\']([^"\']*)["\']', prop_str):
        props[m.group(1)] = m.group(2)
    return props


class _CypherQuery:
    """Parsed simplified Cypher query."""
    def __init__(self):
        self.nodes: list[dict] = []   # [{var, type_name, props}]
        self.rels: list[dict] = []    # [{var, type_name, source_var, target_var}]

    async def execute(self, db: AsyncSession) -> dict:
        # Resolve type names to IDs
        ot_result = await db.execute(select(ObjectType))
        all_ot = {ot.name.lower(): ot for ot in ot_result.scalars().all()}
        lt_result = await db.execute(select(LinkType))
        all_lt = {lt.name.lower(): lt for lt in lt_result.scalars().all()}

        # Determine which object types are involved
        node_type_filters: dict[str, int | None] = {}  # var -> type_id or None
        node_prop_filters: dict[str, dict] = {}  # var -> {prop: value}
        for node in self.nodes:
            var = node["var"]
            tn = node.get("type_name")
            if tn:
                ot = all_ot.get(tn.lower())
                if not ot:
                    raise HTTPException(400, f"Unknown node type: {tn}")
                node_type_filters[var] = ot.id
            else:
                node_type_filters[var] = None
            node_prop_filters[var] = node.get("props", {})

        # Determine which link types are involved
        rel_type_filters: list[int | None] = []
        for rel in self.rels:
            rn = rel.get("type_name")
            if rn:
                lt = all_lt.get(rn.lower())
                if not lt:
                    raise HTTPException(400, f"Unknown link type: {rn}")
                rel_type_filters.append(lt.id)
            else:
                rel_type_filters.append(None)

        # Fetch matching objects
        obj_query = select(ObjectInstance)
        type_id_set: set[int] = set()
        for var, tid in node_type_filters.items():
            if tid is not None:
                type_id_set.add(tid)
        if type_id_set:
            obj_query = obj_query.where(ObjectInstance.object_type_id.in_(type_id_set))
        obj_result = await db.execute(obj_query)
        objects = list(obj_result.scalars().all())

        # Apply property filters
        if any(node_prop_filters.values()):
            filtered = []
            for obj in objects:
                for var, tid in node_type_filters.items():
                    if tid is not None and obj.object_type_id != tid:
                        continue
                    props_filter = node_prop_filters.get(var, {})
                    if props_filter:
                        if all(str(obj.properties.get(k, "")) == v for k, v in props_filter.items()):
                            filtered.append(obj)
                            break
                    else:
                        filtered.append(obj)
                        break
            objects = filtered

        obj_ids = {o.id for o in objects}

        # Fetch matching links
        if self.rels:
            link_query = select(LinkInstance)
            link_conditions = []
            for lt_id in rel_type_filters:
                if lt_id is not None:
                    link_conditions.append(LinkInstance.link_type_id == lt_id)
            if link_conditions:
                link_query = link_query.where(or_(*link_conditions))
            link_result = await db.execute(link_query)
            links = list(link_result.scalars().all())
            # Filter links to only those connecting matching objects
            links = [l for l in links if l.source_object_id in obj_ids and l.target_object_id in obj_ids]
            # Also include objects that are targets/sources of matching links
            extra_ids = set()
            for l in links:
                extra_ids.add(l.source_object_id)
                extra_ids.add(l.target_object_id)
            missing = extra_ids - obj_ids
            if missing:
                extra_result = await db.execute(
                    select(ObjectInstance).where(ObjectInstance.id.in_(missing))
                )
                objects.extend(extra_result.scalars().all())
        else:
            links = []

        return {
            "objects": objects,
            "links": links,
        }


def _parse_cypher(query_str: str) -> _CypherQuery:
    """Parse simplified Cypher into structured query."""
    cq = _CypherQuery()
    m = _MATCH_RE.search(query_str)
    if not m:
        raise HTTPException(400, f"Cannot parse Cypher: {query_str}")
    pattern = m.group(1).strip()
    where_clause = m.group(2)

    # Find all node patterns
    nodes_found = list(_NODE_PAT.finditer(pattern))
    for nm in nodes_found:
        cq.nodes.append({
            "var": nm.group(1),
            "type_name": nm.group(2),
            "props": _parse_node_props(nm.group(3)),
        })

    # Find relationship patterns
    rels_found = list(_REL_PAT.finditer(pattern))
    for i, rm in enumerate(rels_found):
        src_var = nodes_found[i].group(1) if i < len(nodes_found) else None
        tgt_var = nodes_found[i + 1].group(1) if i + 1 < len(nodes_found) else None
        cq.rels.append({
            "var": rm.group(1) or f"_r{i}",
            "type_name": rm.group(2),
            "source_var": src_var,
            "target_var": tgt_var,
        })

    # Parse WHERE clause
    if where_clause:
        for wm in _WHERE_PROP.finditer(where_clause):
            var_name, prop_name, prop_val = wm.group(1), wm.group(2), wm.group(3)
            for node in cq.nodes:
                if node["var"] == var_name:
                    node["props"][prop_name] = prop_val

    if not cq.nodes:
        raise HTTPException(400, f"No node patterns found in: {query_str}")

    return cq


class CypherQueryResponse(ObjectInstanceResponse):
    pass


class CypherResult(BaseModel):
    objects: list[ObjectInstanceResponse]
    links: list[LinkInstanceResponse]

    model_config = {"from_attributes": True}


@router.get("/cypher", response_model=CypherResult)
async def execute_cypher(
    q: str = Query(..., description="Simplified Cypher query"),
    db: AsyncSession = Depends(get_db),
):
    """Execute a simplified Cypher query and return matching nodes and links.

    Examples:
      - MATCH (n:Team) RETURN n
      - MATCH (n:Team)-[:manages]->(m:App) RETURN n, r, m
      - MATCH (n:Server {hostname: "web-01"}) RETURN n
      - MATCH (n)-[:uses]->(m) RETURN n, r, m
    """
    parsed = _parse_cypher(q)
    result = await parsed.execute(db)
    return result


@router.get("/neighborhood", response_model=CypherResult)
async def get_neighborhood(
    object_id: int = Query(..., description="Starting object ID"),
    depth: int = Query(5, ge=1, le=20, description="Max hop distance"),
    db: AsyncSession = Depends(get_db),
):
    """Return all objects and links within `depth` hops of the given object."""
    # Fetch all links once (BFS over the full graph)
    all_links_result = await db.execute(select(LinkInstance))
    all_links = list(all_links_result.scalars().all())

    # Build adjacency: object_id -> [(neighbor_id, link)]
    adj: dict[int, list[tuple[int, LinkInstance]]] = {}
    for lnk in all_links:
        adj.setdefault(lnk.source_object_id, []).append((lnk.target_object_id, lnk))
        adj.setdefault(lnk.target_object_id, []).append((lnk.source_object_id, lnk))

    # BFS
    visited: set[int] = {object_id}
    frontier = [object_id]
    collected_links: list[LinkInstance] = []
    collected_link_ids: set[int] = set()
    for _ in range(depth):
        next_frontier: list[int] = []
        for nid in frontier:
            for neighbor_id, lnk in adj.get(nid, []):
                if lnk.id not in collected_link_ids:
                    collected_links.append(lnk)
                    collected_link_ids.add(lnk.id)
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    next_frontier.append(neighbor_id)
        frontier = next_frontier
        if not frontier:
            break

    # Fetch the visited objects
    if visited:
        obj_result = await db.execute(
            select(ObjectInstance).where(ObjectInstance.id.in_(visited))
        )
        objects = list(obj_result.scalars().all())
    else:
        objects = []

    # Only include links where both endpoints are visited
    links = [l for l in collected_links if l.source_object_id in visited and l.target_object_id in visited]

    return {"objects": objects, "links": links}

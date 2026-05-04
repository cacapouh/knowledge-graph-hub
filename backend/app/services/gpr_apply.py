"""Apply a list of GPR operations to the graph.

Operation vocabulary (Phase 1):
  {"op": "create_object", "client_id"?: str, "object_type": str|int, "properties": dict}
  {"op": "update_object", "object_id": int, "properties": dict}
  {"op": "delete_object", "object_id": int}
  {"op": "create_link",   "link_type": str|int,
                          "source": {"object_id": int} | {"client_id": str},
                          "target": {"object_id": int} | {"client_id": str},
                          "properties"?: dict}
  {"op": "delete_link",   "link_id": int}

`object_type` / `link_type` accept either api_name (str) or numeric id (int).
`client_id` lets a later op reference an object created earlier in the same GPR.

Each op records:
  apply_log[i] = {"index": i, "op": <echo>, "ok": bool, ...details}
  inverse_ops   = list of operations that, run in order, undo the applied changes.

Caveat: for delete_*, the inverse re-creates the row but the new id will differ
from the original. Acceptable for Phase 1.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ontology import ObjectType, LinkType, ObjectInstance, LinkInstance
from app.services.property_validation import validate_and_coerce_properties


class GPRApplyError(Exception):
    """Raised when one of the operations fails. Carries the partial apply_log."""
    def __init__(self, apply_log: list[dict], message: str):
        super().__init__(message)
        self.apply_log = apply_log


async def _resolve_object_type(db: AsyncSession, ref) -> ObjectType:
    if isinstance(ref, int):
        result = await db.execute(select(ObjectType).where(ObjectType.id == ref))
    else:
        result = await db.execute(select(ObjectType).where(ObjectType.api_name == str(ref)))
    ot = result.scalar_one_or_none()
    if not ot:
        raise ValueError(f"object_type not found: {ref!r}")
    return ot


async def _resolve_link_type(db: AsyncSession, ref) -> LinkType:
    if isinstance(ref, int):
        result = await db.execute(select(LinkType).where(LinkType.id == ref))
    else:
        result = await db.execute(select(LinkType).where(LinkType.api_name == str(ref)))
    lt = result.scalar_one_or_none()
    if not lt:
        raise ValueError(f"link_type not found: {ref!r}")
    return lt


def _resolve_endpoint(spec: dict, client_ids: dict[str, int]) -> int:
    if "object_id" in spec:
        return int(spec["object_id"])
    if "client_id" in spec:
        cid = spec["client_id"]
        if cid not in client_ids:
            raise ValueError(f"unknown client_id: {cid!r}")
        return client_ids[cid]
    raise ValueError(f"endpoint must have object_id or client_id: {spec!r}")


async def _get_object(db: AsyncSession, oid: int) -> ObjectInstance:
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == oid))
    obj = result.scalar_one_or_none()
    if not obj:
        raise ValueError(f"object not found: id={oid}")
    return obj


async def _get_link(db: AsyncSession, lid: int) -> LinkInstance:
    result = await db.execute(select(LinkInstance).where(LinkInstance.id == lid))
    link = result.scalar_one_or_none()
    if not link:
        raise ValueError(f"link not found: id={lid}")
    return link


async def apply_operations(
    db: AsyncSession, operations: list[dict]
) -> tuple[list[dict], list[dict]]:
    """Run all operations inside a SAVEPOINT. On any error, rollback the savepoint
    and raise GPRApplyError with the partial apply_log. On success, return
    (apply_log, inverse_ops). The outer transaction is left untouched.
    """
    apply_log: list[dict] = []
    inverse_ops: list[dict] = []
    client_ids: dict[str, int] = {}

    sp = await db.begin_nested()
    try:
        for i, op in enumerate(operations):
            try:
                entry, inverse = await _execute_op(db, op, client_ids)
            except Exception as e:
                apply_log.append({
                    "index": i,
                    "op": op,
                    "ok": False,
                    "error": f"{type(e).__name__}: {e}",
                })
                await sp.rollback()
                raise GPRApplyError(apply_log, f"op {i} failed: {e}")
            apply_log.append({"index": i, "op": op, "ok": True, **entry})
            if inverse is not None:
                inverse_ops.insert(0, inverse)  # reverse order for revert
        await sp.commit()
    except GPRApplyError:
        raise
    return apply_log, inverse_ops


async def _execute_op(
    db: AsyncSession, op: dict, client_ids: dict[str, int]
) -> tuple[dict, dict | None]:
    """Execute one op. Return (log_entry_extras, inverse_op_or_None)."""
    kind = op.get("op")

    if kind == "create_object":
        ot = await _resolve_object_type(db, op["object_type"])
        props = await validate_and_coerce_properties(db, ot.id, op.get("properties") or {})
        obj = ObjectInstance(object_type_id=ot.id, properties=props)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        if cid := op.get("client_id"):
            client_ids[cid] = obj.id
        return (
            {"created_object_id": obj.id},
            {"op": "delete_object", "object_id": obj.id},
        )

    if kind == "update_object":
        obj = await _get_object(db, int(op["object_id"]))
        prior = dict(obj.properties or {})
        obj.properties = await validate_and_coerce_properties(
            db, obj.object_type_id, op["properties"]
        )
        await db.flush()
        return (
            {"updated_object_id": obj.id},
            {"op": "update_object", "object_id": obj.id, "properties": prior},
        )

    if kind == "delete_object":
        obj = await _get_object(db, int(op["object_id"]))
        snapshot = {
            "object_type_id": obj.object_type_id,
            "properties": dict(obj.properties or {}),
        }
        await db.delete(obj)
        await db.flush()
        return (
            {"deleted_object_id": int(op["object_id"])},
            {"op": "create_object",
             "object_type": snapshot["object_type_id"],
             "properties": snapshot["properties"]},
        )

    if kind == "create_link":
        lt = await _resolve_link_type(db, op["link_type"])
        src_id = _resolve_endpoint(op["source"], client_ids)
        tgt_id = _resolve_endpoint(op["target"], client_ids)
        # Validate endpoints' object_type matches the LinkType's expectation.
        src_obj = await _get_object(db, src_id)
        tgt_obj = await _get_object(db, tgt_id)
        if src_obj.object_type_id != lt.source_object_type_id:
            raise ValueError(
                f"link source type mismatch: link_type {lt.api_name!r} expects "
                f"object_type_id={lt.source_object_type_id}, got object id={src_id} "
                f"(object_type_id={src_obj.object_type_id})"
            )
        if tgt_obj.object_type_id != lt.target_object_type_id:
            raise ValueError(
                f"link target type mismatch: link_type {lt.api_name!r} expects "
                f"object_type_id={lt.target_object_type_id}, got object id={tgt_id} "
                f"(object_type_id={tgt_obj.object_type_id})"
            )
        props = op.get("properties") or {}
        link = LinkInstance(
            link_type_id=lt.id,
            source_object_id=src_id,
            target_object_id=tgt_id,
            properties=props,
        )
        db.add(link)
        await db.flush()
        await db.refresh(link)
        return (
            {"created_link_id": link.id},
            {"op": "delete_link", "link_id": link.id},
        )

    if kind == "delete_link":
        link = await _get_link(db, int(op["link_id"]))
        snapshot = {
            "link_type_id": link.link_type_id,
            "source_object_id": link.source_object_id,
            "target_object_id": link.target_object_id,
            "properties": dict(link.properties or {}),
        }
        await db.delete(link)
        await db.flush()
        return (
            {"deleted_link_id": int(op["link_id"])},
            {"op": "create_link",
             "link_type": snapshot["link_type_id"],
             "source": {"object_id": snapshot["source_object_id"]},
             "target": {"object_id": snapshot["target_object_id"]},
             "properties": snapshot["properties"]},
        )

    raise ValueError(f"unknown op: {kind!r}")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)

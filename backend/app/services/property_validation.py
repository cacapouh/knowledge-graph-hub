"""Property validation against the PropertyType schema.

Rules:
- Unknown keys (not in schema) are silently dropped.
- Required + missing/None: use ``default_value`` if defined, else raise.
- Type mismatch: try to coerce ("42" -> 42, "true" -> true). Raise if impossible.
"""
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ontology import DataType, PropertyType


class PropertyValidationError(ValueError):
    """Raised when properties fail schema validation."""


_TRUE = {"true", "1", "yes", "y", "on"}
_FALSE = {"false", "0", "no", "n", "off", ""}


def _coerce_scalar(value: Any, data_type: DataType, prop_name: str) -> Any:
    """Coerce a single (non-array) value to the target type. Raise on failure."""
    if value is None:
        return None

    if data_type == DataType.STRING:
        if isinstance(value, (dict, list)):
            raise PropertyValidationError(
                f"{prop_name}: expected string, got {type(value).__name__}"
            )
        return str(value)

    if data_type == DataType.INTEGER:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            if not value.is_integer():
                raise PropertyValidationError(
                    f"{prop_name}: cannot coerce {value!r} to integer"
                )
            return int(value)
        if isinstance(value, str):
            s = value.strip()
            try:
                return int(s)
            except ValueError:
                try:
                    f = float(s)
                except ValueError:
                    raise PropertyValidationError(
                        f"{prop_name}: cannot coerce {value!r} to integer"
                    )
                if not f.is_integer():
                    raise PropertyValidationError(
                        f"{prop_name}: cannot coerce {value!r} to integer"
                    )
                return int(f)
        raise PropertyValidationError(
            f"{prop_name}: cannot coerce {value!r} to integer"
        )

    if data_type == DataType.FLOAT:
        if isinstance(value, bool):
            return float(value)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError:
                raise PropertyValidationError(
                    f"{prop_name}: cannot coerce {value!r} to float"
                )
        raise PropertyValidationError(
            f"{prop_name}: cannot coerce {value!r} to float"
        )

    if data_type == DataType.BOOLEAN:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            s = value.strip().lower()
            if s in _TRUE:
                return True
            if s in _FALSE:
                return False
            raise PropertyValidationError(
                f"{prop_name}: cannot coerce {value!r} to boolean"
            )
        raise PropertyValidationError(
            f"{prop_name}: cannot coerce {value!r} to boolean"
        )

    if data_type == DataType.DATE:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, str):
            try:
                return date.fromisoformat(value.strip()).isoformat()
            except ValueError:
                raise PropertyValidationError(
                    f"{prop_name}: cannot coerce {value!r} to date (expected YYYY-MM-DD)"
                )
        raise PropertyValidationError(
            f"{prop_name}: cannot coerce {value!r} to date"
        )

    if data_type == DataType.TIMESTAMP:
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.strip().replace("Z", "+00:00")).isoformat()
            except ValueError:
                raise PropertyValidationError(
                    f"{prop_name}: cannot coerce {value!r} to timestamp (ISO 8601 expected)"
                )
        raise PropertyValidationError(
            f"{prop_name}: cannot coerce {value!r} to timestamp"
        )

    if data_type == DataType.SKILL:
        # Value is a Skill.id (integer). Accept "3" or 3.
        if isinstance(value, bool):
            raise PropertyValidationError(
                f"{prop_name}: skill expects an id (int), got bool"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            try:
                return int(value.strip())
            except ValueError:
                raise PropertyValidationError(
                    f"{prop_name}: skill expects an id (int), got {value!r}"
                )
        raise PropertyValidationError(
            f"{prop_name}: skill expects an id (int), got {type(value).__name__}"
        )

    if data_type == DataType.OBJECT:
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                raise PropertyValidationError(
                    f"{prop_name}: cannot coerce {value!r} to object (invalid JSON)"
                )
            if not isinstance(parsed, dict):
                raise PropertyValidationError(
                    f"{prop_name}: expected JSON object, got {type(parsed).__name__}"
                )
            return parsed
        raise PropertyValidationError(
            f"{prop_name}: expected object, got {type(value).__name__}"
        )

    # ARRAY/GEOSHAPE/GEOPOINT: pass-through (array handling done at call site)
    return value


def _coerce_value(value: Any, prop: PropertyType) -> Any:
    """Coerce respecting is_array. Treats DataType.ARRAY same as is_array."""
    is_array = prop.is_array or prop.data_type == DataType.ARRAY
    if not is_array:
        return _coerce_scalar(value, prop.data_type, prop.name)

    # Array case: each element must coerce to data_type (unless data_type is ARRAY itself)
    inner_type = prop.data_type if prop.data_type != DataType.ARRAY else DataType.STRING

    if isinstance(value, str):
        # Allow JSON-encoded arrays from form inputs
        s = value.strip()
        if s.startswith("["):
            import json
            try:
                value = json.loads(s)
            except json.JSONDecodeError:
                raise PropertyValidationError(
                    f"{prop.name}: cannot parse {value!r} as array"
                )
        else:
            # Treat single value as single-element list for ergonomics
            value = [s] if s else []

    if not isinstance(value, list):
        raise PropertyValidationError(
            f"{prop.name}: expected array, got {type(value).__name__}"
        )

    return [_coerce_scalar(v, inner_type, prop.name) for v in value]


async def validate_and_coerce_properties(
    db: AsyncSession,
    object_type_id: int,
    properties: dict[str, Any] | None,
) -> dict[str, Any]:
    """Validate ``properties`` against the schema for ``object_type_id``.

    - Drop keys not in schema.
    - Coerce values to declared types.
    - Fill missing required values with ``default_value`` if set; otherwise raise.
    """
    result = await db.execute(
        select(PropertyType).where(PropertyType.object_type_id == object_type_id)
    )
    prop_types = list(result.scalars().all())

    incoming = dict(properties or {})
    out: dict[str, Any] = {}

    for prop in prop_types:
        key = prop.api_name
        present = key in incoming and incoming[key] is not None and incoming[key] != ""

        if present:
            out[key] = _coerce_value(incoming[key], prop)
        elif prop.default_value is not None:
            # Default values are stored in target type; still pass through coerce
            # in case the stored default was JSON-stringified at write time.
            out[key] = _coerce_value(prop.default_value, prop)
        elif prop.is_required:
            raise PropertyValidationError(
                f"{prop.name} is required but no value or default was provided"
            )
        # else: optional + absent → omit

    return out

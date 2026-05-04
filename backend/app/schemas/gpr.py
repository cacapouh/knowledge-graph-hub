from datetime import datetime
from pydantic import BaseModel


class GPRCreate(BaseModel):
    title: str
    description: str = ""
    source: str = ""
    auto_merge: bool = False
    operations: list[dict] = []


class GPRResponse(BaseModel):
    id: int
    title: str
    description: str
    source: str
    status: str
    auto_merge: bool
    operations: list[dict]
    apply_log: list[dict]
    inverse_ops: list[dict]
    applied_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

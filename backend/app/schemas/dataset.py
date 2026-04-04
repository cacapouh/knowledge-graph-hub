from datetime import datetime
from pydantic import BaseModel


class DatasetCreate(BaseModel):
    name: str
    description: str = ""
    project_id: int
    schema_def: dict = {}
    format: str = "parquet"


class DatasetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    schema_def: dict | None = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: str
    project_id: int
    schema_def: dict
    storage_path: str
    row_count: int
    size_bytes: int
    format: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

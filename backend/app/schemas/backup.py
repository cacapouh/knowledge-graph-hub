from datetime import datetime
from pydantic import BaseModel


class GraphBackupResponse(BaseModel):
    id: int
    filename: str
    change_type: str
    description: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class GraphBackupCreate(BaseModel):
    description: str = ""

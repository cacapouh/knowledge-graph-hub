from datetime import datetime
from pydantic import BaseModel


class PipelineCreate(BaseModel):
    name: str
    description: str = ""
    project_id: int
    config: dict = {}
    schedule: dict = {}
    input_dataset_ids: list[int] = []
    output_dataset_id: int | None = None


class PipelineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    config: dict | None = None
    schedule: dict | None = None


class PipelineResponse(BaseModel):
    id: int
    name: str
    description: str
    project_id: int
    status: str
    config: dict
    schedule: dict
    input_dataset_ids: list
    output_dataset_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineStepCreate(BaseModel):
    pipeline_id: int
    name: str
    step_order: int = 0
    step_type: str
    config: dict = {}


class PipelineStepResponse(BaseModel):
    id: int
    pipeline_id: int
    name: str
    step_order: int
    step_type: str
    config: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineRunResponse(BaseModel):
    id: int
    pipeline_id: int
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    metrics: dict

    model_config = {"from_attributes": True}

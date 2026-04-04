from datetime import datetime
from pydantic import BaseModel


# --- Object Types ---

class ObjectTypeCreate(BaseModel):
    name: str
    api_name: str
    description: str = ""
    project_id: int
    primary_key_property: str | None = None
    title_property: str | None = None
    icon: str = "cube"
    color: str = "#6366f1"
    dataset_id: int | None = None


class ObjectTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    primary_key_property: str | None = None
    title_property: str | None = None
    icon: str | None = None
    color: str | None = None
    dataset_id: int | None = None


class ObjectTypeResponse(BaseModel):
    id: int
    name: str
    api_name: str
    description: str
    project_id: int
    primary_key_property: str | None
    title_property: str | None
    icon: str
    color: str
    dataset_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Property Types ---

class PropertyTypeCreate(BaseModel):
    object_type_id: int
    name: str
    api_name: str
    description: str = ""
    data_type: str = "string"
    is_required: bool = False
    is_indexed: bool = False
    is_array: bool = False
    config: dict = {}


class PropertyTypeResponse(BaseModel):
    id: int
    object_type_id: int
    name: str
    api_name: str
    description: str
    data_type: str
    is_required: bool
    is_indexed: bool
    is_array: bool
    config: dict
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Link Types ---

class LinkTypeCreate(BaseModel):
    name: str
    api_name: str
    description: str = ""
    project_id: int
    source_object_type_id: int
    target_object_type_id: int
    cardinality: str = "many_to_many"
    inverse_name: str | None = None


class LinkTypeResponse(BaseModel):
    id: int
    name: str
    api_name: str
    description: str
    project_id: int
    source_object_type_id: int
    target_object_type_id: int
    cardinality: str
    inverse_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Action Types ---

class ActionTypeCreate(BaseModel):
    name: str
    api_name: str
    description: str = ""
    project_id: int
    object_type_id: int | None = None
    parameters: list = []
    logic: dict = {}


class ActionTypeResponse(BaseModel):
    id: int
    name: str
    api_name: str
    description: str
    project_id: int
    object_type_id: int | None
    parameters: list
    logic: dict
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Object Instances ---

class ObjectInstanceCreate(BaseModel):
    object_type_id: int
    properties: dict = {}


class ObjectInstanceUpdate(BaseModel):
    properties: dict


class ObjectInstanceResponse(BaseModel):
    id: int
    object_type_id: int
    properties: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Link Instances ---

class LinkInstanceCreate(BaseModel):
    link_type_id: int
    source_object_id: int
    target_object_id: int
    properties: dict = {}


class LinkInstanceResponse(BaseModel):
    id: int
    link_type_id: int
    source_object_id: int
    target_object_id: int
    properties: dict
    created_at: datetime

    model_config = {"from_attributes": True}

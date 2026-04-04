from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum, JSON, func,
)
import enum

from app.database import Base


class DataType(str, enum.Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    TIMESTAMP = "timestamp"
    ARRAY = "array"
    OBJECT = "object"
    GEOSHAPE = "geoshape"
    GEOPOINT = "geopoint"


class Cardinality(str, enum.Enum):
    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_MANY = "many_to_many"


class ObjectType(Base):
    """Ontology object type definition (e.g., Employee, Equipment, Order)."""
    __tablename__ = "object_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    api_name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    primary_key_property = Column(String(255), nullable=True)
    title_property = Column(String(255), nullable=True)
    icon = Column(String(100), default="cube")
    color = Column(String(7), default="#6366f1")
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)  # backing dataset
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PropertyType(Base):
    """Property definition for an object type."""
    __tablename__ = "property_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    object_type_id = Column(Integer, ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    api_name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    data_type = Column(Enum(DataType), nullable=False, default=DataType.STRING)
    is_required = Column(Boolean, default=False)
    is_indexed = Column(Boolean, default=False)
    is_array = Column(Boolean, default=False)
    config = Column(JSON, default=dict)  # additional config (e.g., enum values, format)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LinkType(Base):
    """Relationship definition between object types."""
    __tablename__ = "link_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    api_name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_object_type_id = Column(Integer, ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False)
    target_object_type_id = Column(Integer, ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False)
    cardinality = Column(Enum(Cardinality), default=Cardinality.MANY_TO_MANY)
    inverse_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ActionType(Base):
    """Action type that modifies objects in the ontology."""
    __tablename__ = "action_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    api_name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    object_type_id = Column(Integer, ForeignKey("object_types.id", ondelete="CASCADE"), nullable=True)
    parameters = Column(JSON, default=list)  # parameter definitions
    logic = Column(JSON, default=dict)  # action logic/rules
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Interface(Base):
    """Interface type for object type polymorphism."""
    __tablename__ = "interfaces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    api_name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    properties = Column(JSON, default=list)  # shared property definitions
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ObjectInstance(Base):
    """Actual object instance in the ontology."""
    __tablename__ = "object_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    object_type_id = Column(Integer, ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False, index=True)
    properties = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LinkInstance(Base):
    """Actual link instance between two objects."""
    __tablename__ = "link_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    link_type_id = Column(Integer, ForeignKey("link_types.id", ondelete="CASCADE"), nullable=False, index=True)
    source_object_id = Column(Integer, ForeignKey("object_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    target_object_id = Column(Integer, ForeignKey("object_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    properties = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

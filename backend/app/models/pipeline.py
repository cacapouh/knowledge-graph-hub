from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, func
import enum

from app.database import Base


class PipelineStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(PipelineStatus), default=PipelineStatus.DRAFT)
    config = Column(JSON, default=dict)  # pipeline configuration
    schedule = Column(JSON, default=dict)  # cron/interval schedule
    input_dataset_ids = Column(JSON, default=list)
    output_dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PipelineStep(Base):
    __tablename__ = "pipeline_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    step_order = Column(Integer, nullable=False, default=0)
    step_type = Column(String(100), nullable=False)  # filter, join, aggregate, transform, etc.
    config = Column(JSON, default=dict)  # step-specific configuration
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(RunStatus), default=RunStatus.PENDING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    metrics = Column(JSON, default=dict)  # rows processed, duration, etc.
    triggered_by = Column(Integer, nullable=True)

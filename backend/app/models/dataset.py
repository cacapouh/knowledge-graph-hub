from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger, JSON, func

from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    schema_def = Column(JSON, default=dict)  # column definitions
    storage_path = Column(String(500), default="")
    row_count = Column(BigInteger, default=0)
    size_bytes = Column(BigInteger, default=0)
    format = Column(String(50), default="parquet")  # parquet, csv, json
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    storage_path = Column(String(500), nullable=False)
    row_count = Column(BigInteger, default=0)
    size_bytes = Column(BigInteger, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

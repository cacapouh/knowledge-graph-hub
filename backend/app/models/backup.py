from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, func

from app.database import Base


class GraphBackup(Base):
    """Snapshot of the database taken on graph changes."""
    __tablename__ = "graph_backups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(500), nullable=False, unique=True)
    change_type = Column(String(100), nullable=False)  # e.g. "create_object", "delete_link"
    description = Column(Text, default="")
    size_bytes = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

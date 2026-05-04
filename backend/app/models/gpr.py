from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Boolean, func

from app.database import Base


class GraphPullRequest(Base):
    """Graph Pull Request — a proposed batch of graph mutations awaiting (or post-) apply."""
    __tablename__ = "graph_pull_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    source = Column(String(255), default="")  # free-form provenance tag (e.g. "claude-code")
    status = Column(String(32), nullable=False, default="open")  # open | merged | failed | reverted
    auto_merge = Column(Boolean, default=False)
    operations = Column(JSON, nullable=False, default=list)
    apply_log = Column(JSON, nullable=False, default=list)
    inverse_ops = Column(JSON, nullable=False, default=list)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

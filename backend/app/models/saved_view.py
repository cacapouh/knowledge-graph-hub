from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func

from app.database import Base


class SavedView(Base):
    """A saved graph view (silo) with selected node/edge types."""
    __tablename__ = "saved_views"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    object_type_ids = Column(JSON, nullable=False, default=list)  # list of ObjectType IDs to show
    link_type_ids = Column(JSON, nullable=False, default=list)    # list of LinkType IDs to show
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

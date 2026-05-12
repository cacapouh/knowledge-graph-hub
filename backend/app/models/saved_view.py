from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func

from app.database import Base


class SavedView(Base):
    """A saved graph view (silo) with a list of node/edge selection conditions.

    `conditions` is a list of dicts, OR-combined to compute the visible subgraph:
      {"kind": "type_filter",         "object_type_ids": [int], "link_type_ids": [int]}
      {"kind": "neighborhood_of_type","object_type_id": int,    "distance": int}
      {"kind": "neighborhood_of_ids", "object_ids": [int],      "distance": int}
    """
    __tablename__ = "saved_views"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    # Legacy columns: kept for backward compatibility with existing rows; new code
    # reads/writes via `conditions` and these are mirrored from the first
    # `type_filter` condition (if any) for read-only consumers.
    object_type_ids = Column(JSON, nullable=False, default=list)
    link_type_ids = Column(JSON, nullable=False, default=list)
    conditions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

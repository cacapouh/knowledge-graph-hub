from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, func

from app.database import Base


class Skill(Base):
    """Reusable skill that can be referenced from object properties.

    `mcps` holds a list of MCP server configs (Claude Code .mcp.json shape):
      {name, type, command?, args?, env?, url?, headers?}
    """
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, default="")
    prompt = Column(Text, nullable=False)
    mcps = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

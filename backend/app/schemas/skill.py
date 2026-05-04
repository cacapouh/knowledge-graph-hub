from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class MCPConfig(BaseModel):
    """Single MCP server config (Claude Code .mcp.json compatible).

    Either ``command`` (stdio) or ``url`` (http/sse) must be set in practice,
    but we accept any subset to stay forward-compatible.
    """
    name: str
    type: Literal["stdio", "http", "sse"] = "stdio"
    command: str | None = None
    args: list[str] = []
    env: dict[str, str] = {}
    url: str | None = None
    headers: dict[str, str] = {}


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    prompt: str
    mcps: list[MCPConfig] = []


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    prompt: str | None = None
    mcps: list[MCPConfig] | None = None


class SkillResponse(BaseModel):
    id: int
    name: str
    description: str
    prompt: str
    mcps: list[MCPConfig]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

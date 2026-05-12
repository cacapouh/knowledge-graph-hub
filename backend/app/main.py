from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import engine, Base
from app.api import ontology, views, gpr

# Import all models so they are registered with Base
import app.models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column adds for tables created by an earlier schema version.
        await conn.execute(text(
            "ALTER TABLE property_types ADD COLUMN IF NOT EXISTS default_value JSONB"
        ))
        # Downgrade any legacy SKILL-typed properties left over from the removed
        # Skills feature, so the Python enum stays consistent with stored rows.
        await conn.execute(text(
            "UPDATE property_types SET data_type = 'STRING' WHERE data_type = 'SKILL'"
        ))
        # SavedView.conditions: new JSONB column for multi-condition views.
        await conn.execute(text(
            "ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]'::jsonb"
        ))
        # Backfill: rows that still have legacy object_type_ids/link_type_ids
        # (which are JSON-typed) but an empty conditions[] get a single
        # type_filter condition synthesized. Cast to jsonb for comparisons.
        await conn.execute(text(
            """
            UPDATE saved_views
            SET conditions = jsonb_build_array(
                jsonb_build_object(
                    'kind', 'type_filter',
                    'object_type_ids', COALESCE(object_type_ids::jsonb, '[]'::jsonb),
                    'link_type_ids',   COALESCE(link_type_ids::jsonb,   '[]'::jsonb)
                )
            )
            WHERE (conditions IS NULL OR conditions = '[]'::jsonb)
              AND (
                (object_type_ids IS NOT NULL AND object_type_ids::jsonb <> '[]'::jsonb)
                OR (link_type_ids IS NOT NULL AND link_type_ids::jsonb <> '[]'::jsonb)
              )
            """
        ))
    yield
    await engine.dispose()


app = FastAPI(
    title="Knowledge Graph Hub",
    description="Knowledge graph & data platform for infrastructure management",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ontology.router)
app.include_router(views.router)
app.include_router(gpr.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}

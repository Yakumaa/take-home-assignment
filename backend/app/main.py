# app/main.py  — populated in Phase 2
"""
main.py — FastAPI application factory.

Responsibilities:
  - Create the FastAPI app with metadata
  - Register CORS middleware
  - Mount routers
  - Initialize DB tables on startup
  - Provide a health-check endpoint
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.models import create_tables
from app.routers import auth as auth_router
from app.routers import candidates as candidates_router

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

# app = FastAPI(
#     title="TechKraft Recruitment Dashboard API",
#     description=(
#         "Internal tool for managing candidate assessments, scoring, "
#         "and AI-assisted review. Role-based access: reviewer | admin."
#     ),
#     version="1.0.0",
#     docs_url="/docs",
#     redoc_url="/redoc",
# )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup logic
    create_tables()

    yield

    # shutdown logic (optional)

app = FastAPI(
    title="TechKraft Recruitment Dashboard API",
    description=(
        "Internal tool for managing candidate assessments, scoring, "
        "and AI-assisted review. Role-based access: reviewer | admin."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# In production, replace "*" with the specific frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth_router.router)
app.include_router(candidates_router.router)

# ---------------------------------------------------------------------------
# Startup event — create tables
# ---------------------------------------------------------------------------

# @app.on_event("startup")
# def on_startup():
#     """
#     Ensure all SQLAlchemy models are reflected as tables in the database.
#     Safe to call repeatedly — create_all() is idempotent.
#     """
#     create_tables()

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
def health_check():
    """Simple liveness probe used by Docker and load balancers."""
    return {"status": "ok"}
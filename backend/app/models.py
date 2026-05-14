"""
models.py — SQLAlchemy ORM models and database engine setup.

Entities:
  - User       : authenticated reviewer or admin
  - Candidate  : job applicant (soft-deleted via deleted_at)
  - Score      : reviewer score for a candidate category
"""

import os
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/techkraft.db")

# connect_args is SQLite-specific: allows the same connection across threads
# (needed because FastAPI runs sync routes in a threadpool)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,  # set True to see SQL in logs during debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True)
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password: str = Column(String(255), nullable=False)

    # CRITICAL: role is ONLY ever set server-side.
    # Valid values: "reviewer" | "admin"
    role: str = Column(
        Enum("reviewer", "admin", name="user_role"),
        nullable=False,
        default="reviewer",
    )

    created_at: datetime = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    scores = relationship("Score", back_populates="reviewer", lazy="select")


# ---------------------------------------------------------------------------
# Candidate
# ---------------------------------------------------------------------------

class Candidate(Base):
    __tablename__ = "candidates"

    id: int = Column(Integer, primary_key=True, index=True)
    name: str = Column(String(255), nullable=False)
    email: str = Column(String(255), unique=True, nullable=False)
    role_applied: str = Column(String(255), nullable=False)

    # Valid values: "new" | "reviewed" | "hired" | "rejected" | "archived"
    # "archived" is the soft-delete status (set alongside deleted_at)
    status: str = Column(
        Enum("new", "reviewed", "hired", "rejected", "archived", name="candidate_status"),
        nullable=False,
        default="new",
    )

    # Stored as a JSON array, e.g. ["Python", "React", "Docker"]
    skills: list = Column(JSON, nullable=False, default=list)

    # Admin-only field — NEVER returned to reviewer role
    internal_notes: str = Column(Text, nullable=True)

    # Populated by the mock AI summary endpoint
    ai_summary: str = Column(Text, nullable=True)

    created_at: datetime = Column(DateTime, server_default=func.now(), nullable=False)

    # --- Soft delete ---
    # Setting this column (and status → "archived") is the ONLY way to remove a candidate.
    # Hard DELETE queries are never issued against this table.
    deleted_at: datetime = Column(DateTime, nullable=True, default=None)

    # Relationships
    scores = relationship("Score", back_populates="candidate", lazy="select")

    # Indexes for common filter patterns
    __table_args__ = (
        Index("ix_candidates_status", "status"),
        Index("ix_candidates_role_applied", "role_applied"),
        # Partial-style covering index for "active" candidates (deleted_at IS NULL)
        Index("ix_candidates_active", "deleted_at", "status"),
    )


# ---------------------------------------------------------------------------
# Score
# ---------------------------------------------------------------------------

class Score(Base):
    __tablename__ = "scores"

    id: int = Column(Integer, primary_key=True, index=True)

    candidate_id: int = Column(
        Integer, ForeignKey("candidates.id", ondelete="RESTRICT"), nullable=False
    )
    reviewer_id: int = Column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    category: str = Column(String(100), nullable=False)

    # Enforced in the Pydantic schema as ge=1, le=5; stored as float for flexibility
    score: float = Column(Float, nullable=False)

    note: str = Column(Text, nullable=True)

    created_at: datetime = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    candidate = relationship("Candidate", back_populates="scores")
    reviewer = relationship("User", back_populates="scores")

    # Index for fast per-candidate score lookups
    __table_args__ = (
        Index("ix_scores_candidate_id", "candidate_id"),
        Index("ix_scores_reviewer_id", "reviewer_id"),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_db():
    """
    FastAPI dependency that yields a DB session and guarantees cleanup.
    Usage:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables. Called once at application startup."""
    # Ensure the data directory exists (important inside Docker)
    db_path = DATABASE_URL.replace("sqlite:///", "").replace("./", "")
    dir_name = os.path.dirname(db_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    Base.metadata.create_all(bind=engine)
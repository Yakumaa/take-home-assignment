"""
schemas.py — Pydantic request/response models.

Key design decisions:
  - UserCreate has NO `role` field — the server hardcodes role="reviewer" at registration.
  - CandidateResponse (reviewer-safe) never includes `internal_notes`.
  - CandidateAdminResponse extends it to add `internal_notes`.
  - ScoreResponse includes reviewer_email so the admin list is human-readable.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator

# Auth schemas
class UserCreate(BaseModel):
    """
    Registration payload.
    NOTE: There is intentionally NO `role` field here.
    The server always assigns role="reviewer". Any `role` key sent by the
    client is silently ignored by Pydantic's strict model parsing.
    """
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """Decoded JWT payload stored in the token."""
    user_id: int
    role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Score schemas
class ScoreCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    score: float = Field(..., ge=1, le=5, description="Score between 1 and 5 inclusive")
    note: Optional[str] = Field(None, max_length=2000)

class ScoreResponse(BaseModel):
    id: int
    candidate_id: int
    category: str
    score: float
    note: Optional[str]
    reviewer_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

# Candidate schemas
class CandidateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    role_applied: str = Field(..., min_length=1, max_length=255)
    skills: List[str] = Field(default_factory=list)
    internal_notes: Optional[str] = None

class CandidateStatusUpdate(BaseModel):
    """Used by admin to update status or internal_notes."""
    status: Optional[str] = Field(
        None,
        pattern="^(new|reviewed|hired|rejected)$",
        description="Cannot be set to 'archived' via this endpoint — use DELETE instead",
    )
    internal_notes: Optional[str] = None

class CandidateResponse(BaseModel):
    """
    Reviewer-safe response — does NOT include internal_notes.
    This is the base response shape for all non-admin consumers.
    """
    id: int
    name: str
    email: EmailStr
    role_applied: str
    status: str
    skills: List[str]
    ai_summary: Optional[str]
    created_at: datetime
    scores: List[ScoreResponse] = []

    model_config = {"from_attributes": True}

class CandidateAdminResponse(CandidateResponse):
    """
    Admin-only response — extends CandidateResponse with internal_notes.
    The router decides which schema to use based on the current user's role.
    """
    internal_notes: Optional[str]

class CandidateSummary(BaseModel):
    """Lightweight representation for the list endpoint (no scores)."""
    id: int
    name: str
    email: EmailStr
    role_applied: str
    status: str
    skills: List[str]
    created_at: datetime

    model_config = {"from_attributes": True}

# AI Summary schema
class SummaryResponse(BaseModel):
    candidate_id: int
    ai_summary: str
    generated_at: datetime

# Pagination wrapper
T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated envelope used by list endpoints."""
    total: int
    page: int
    page_size: int
    items: List[T]
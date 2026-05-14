"""
services/candidate_service.py — Business logic layer for candidates and scores.

Keeping this separate from the router layer means:
  - Routers handle HTTP concerns (status codes, request/response shapes)
  - Services handle data access, filtering, RBAC field masking, and pagination
  - Tests can call service functions directly without HTTP overhead
"""

from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Candidate, Score, User
from app.schemas import (
    CandidateAdminResponse,
    CandidateCreate,
    CandidateResponse,
    CandidateStatusUpdate,
    PaginatedResponse,
    ScoreCreate,
    ScoreResponse,
)


# ---------------------------------------------------------------------------
# Candidate CRUD
# ---------------------------------------------------------------------------

def create_candidate(db: Session, payload: CandidateCreate) -> Candidate:
    """Create a new candidate. Only admins should call this via the router."""
    existing = db.query(Candidate).filter(Candidate.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A candidate with this email already exists",
        )
    candidate = Candidate(
        name=payload.name,
        email=payload.email,
        role_applied=payload.role_applied,
        skills=payload.skills,
        internal_notes=payload.internal_notes,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def list_candidates(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None,
    role_applied: Optional[str] = None,
    skill: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse:
    """
    Return a paginated list of active (non-deleted) candidates.

    Filtering:
      - status       : exact match on candidates.status
      - role_applied : exact match on candidates.role_applied
      - skill        : JSON array contains the given skill (case-insensitive LIKE)
      - keyword      : case-insensitive search across name, email, role_applied

    IMPORTANT: All filtering is done in SQL — not in Python — to avoid the
    full-table-scan anti-pattern described in the assignment debugging section.
    """
    # Clamp page_size to assignment spec: max 50
    page_size = min(page_size, 50)
    page_size = max(page_size, 1)
    page = max(page, 1)

    query = db.query(Candidate).filter(Candidate.deleted_at.is_(None))

    if status_filter:
        query = query.filter(Candidate.status == status_filter)

    if role_applied:
        query = query.filter(Candidate.role_applied == role_applied)

    if skill:
        # SQLite stores JSON as text; LIKE '%"Python"%' matches array elements
        query = query.filter(Candidate.skills.like(f'%"{skill}"%'))

    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            or_(
                Candidate.name.ilike(kw),
                Candidate.email.ilike(kw),
                Candidate.role_applied.ilike(kw),
            )
        )

    total = query.count()
    offset = (page - 1) * page_size
    candidates = query.order_by(Candidate.created_at.desc()).offset(offset).limit(page_size).all()

    # Build lightweight summary items (no scores) for the list view
    from app.schemas import CandidateSummary  # local import to avoid circular
    items = [CandidateSummary.model_validate(c) for c in candidates]

    return PaginatedResponse(total=total, page=page, page_size=page_size, items=items)


def get_candidate_detail(
    db: Session,
    candidate_id: int,
    current_user: User,
) -> Union[CandidateResponse, CandidateAdminResponse]:
    """
    Return full candidate detail.

    RBAC:
      - Reviewer: receives CandidateResponse (no internal_notes),
                  scores filtered to only their own.
      - Admin: receives CandidateAdminResponse (includes internal_notes),
               scores include all reviewers.
    """
    candidate = _get_active_candidate_or_404(db, candidate_id)

    if current_user.role == "admin":
        scores = candidate.scores  # all scores
        data = CandidateAdminResponse.model_validate(candidate)
        data.scores = [ScoreResponse.model_validate(s) for s in scores]
    else:
        # Reviewer sees only their own scores
        own_scores = [s for s in candidate.scores if s.reviewer_id == current_user.id]
        data = CandidateResponse.model_validate(candidate)
        data.scores = [ScoreResponse.model_validate(s) for s in own_scores]

    return data


def update_candidate(
    db: Session,
    candidate_id: int,
    payload: CandidateStatusUpdate,
    current_user: User,
) -> Candidate:
    """
    Update candidate status or internal_notes (admin only for notes).
    """
    candidate = _get_active_candidate_or_404(db, candidate_id)

    if payload.status is not None:
        candidate.status = payload.status

    if payload.internal_notes is not None:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can edit internal notes",
            )
        candidate.internal_notes = payload.internal_notes

    db.commit()
    db.refresh(candidate)
    return candidate


def soft_delete_candidate(db: Session, candidate_id: int) -> dict:
    """
    Soft-delete a candidate by setting deleted_at and status = "archived".
    Never issues a SQL DELETE statement.
    """
    candidate = _get_active_candidate_or_404(db, candidate_id)
    candidate.deleted_at = datetime.now(timezone.utc)
    candidate.status = "archived"
    db.commit()
    return {"detail": f"Candidate {candidate_id} archived successfully"}


# ---------------------------------------------------------------------------
# Scores
# ---------------------------------------------------------------------------

def submit_score(
    db: Session,
    candidate_id: int,
    payload: ScoreCreate,
    current_user: User,
) -> ScoreResponse:
    """
    Submit a score for a candidate category.
    Any authenticated user (reviewer or admin) may score.
    """
    _get_active_candidate_or_404(db, candidate_id)

    score = Score(
        candidate_id=candidate_id,
        reviewer_id=current_user.id,
        category=payload.category,
        score=payload.score,
        note=payload.note,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return ScoreResponse.model_validate(score)


# ---------------------------------------------------------------------------
# AI Summary (mock)
# ---------------------------------------------------------------------------

def save_ai_summary(db: Session, candidate_id: int, summary: str) -> Candidate:
    """Persist the generated AI summary string to the candidate record."""
    candidate = _get_active_candidate_or_404(db, candidate_id)
    candidate.ai_summary = summary
    db.commit()
    db.refresh(candidate)
    return candidate


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_active_candidate_or_404(db: Session, candidate_id: int) -> Candidate:
    """Fetch a non-deleted candidate by id, or raise 404."""
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.deleted_at.is_(None))
        .first()
    )
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate {candidate_id} not found",
        )
    return candidate
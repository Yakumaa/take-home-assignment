"""
routers/candidates.py — All candidate-related HTTP endpoints.

Endpoints:
  GET    /candidates                  List with filters + pagination
  POST   /candidates                  Create (admin only)
  GET    /candidates/{id}             Detail (RBAC: reviewer vs admin response)
  PATCH  /candidates/{id}             Update status / internal_notes
  DELETE /candidates/{id}             Soft delete (admin only)
  POST   /candidates/{id}/scores      Submit a score
  POST   /candidates/{id}/summary     Trigger mock AI summary (async, 2s delay)
  GET    /candidates/{id}/stream      SSE stream of score updates (stretch goal)
"""

import asyncio
import json
import random
from datetime import datetime, timezone
from typing import Optional, Union

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_admin
from app.models import Score, User, get_db
from app.schemas import (
    CandidateAdminResponse,
    CandidateCreate,
    CandidateResponse,
    CandidateStatusUpdate,
    PaginatedResponse,
    ScoreCreate,
    ScoreResponse,
    SummaryResponse,
)
from app.services import candidate_service as svc

router = APIRouter(prefix="/candidates", tags=["candidates"])

# List candidates
@router.get(
    "",
    response_model=PaginatedResponse,
    summary="List candidates with optional filters and pagination",
)
def list_candidates(
    status: Optional[str] = Query(None, description="Filter by status (new/reviewed/hired/rejected)"),
    role_applied: Optional[str] = Query(None, description="Filter by role applied"),
    skill: Optional[str] = Query(None, description="Filter by skill (exact match within skills array)"),
    keyword: Optional[str] = Query(None, description="Keyword search across name, email, role_applied"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=50, description="Results per page (max 50)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.list_candidates(
        db=db,
        current_user=current_user,
        status_filter=status,
        role_applied=role_applied,
        skill=skill,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )

# Create candidate (admin only)
@router.post(
    "",
    response_model=CandidateAdminResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new candidate (admin only)",
)
def create_candidate(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    candidate = svc.create_candidate(db, payload)
    return svc.get_candidate_detail(db, candidate.id, current_user)

# Get candidate detail
@router.get(
    "/{candidate_id}",
    response_model=Union[CandidateAdminResponse, CandidateResponse],
    summary="Get candidate detail. Admins see internal_notes and all scores.",
)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_candidate_detail(db, candidate_id, current_user)

# Update candidate (status / internal_notes)
@router.patch(
    "/{candidate_id}",
    response_model=Union[CandidateAdminResponse, CandidateResponse],
    summary="Update candidate status or internal_notes",
)
def update_candidate(
    candidate_id: int,
    payload: CandidateStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc.update_candidate(db, candidate_id, payload, current_user)
    return svc.get_candidate_detail(db, candidate_id, current_user)

# Soft delete candidate (admin only)
@router.delete(
    "/{candidate_id}",
    summary="Soft-delete a candidate (sets status=archived, never hard deletes)",
)
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Sets deleted_at = now() and status = "archived".
    The row is NEVER removed from the database.
    """
    return svc.soft_delete_candidate(db, candidate_id)

# Submit score
@router.post(
    "/{candidate_id}/scores",
    response_model=ScoreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a score for a candidate category",
)
def submit_score(
    candidate_id: int,
    payload: ScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.submit_score(db, candidate_id, payload, current_user)

# Mock AI summary  (async — simulates LLM latency)
@router.post(
    "/{candidate_id}/summary",
    response_model=SummaryResponse,
    summary="Trigger AI summary generation (mock — 2s simulated delay)",
)
async def generate_summary(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simulates an async LLM call.

    In a production system this would:
      1. Enqueue a background job (Celery / ARQ / SQS)
      2. Return a 202 Accepted with a job_id
      3. The client polls or listens via SSE for completion

    For this assessment we simulate the latency with asyncio.sleep(2)
    and return a deterministic mock summary inline.
    """
    # Verify candidate exists before sleeping (fail fast)
    candidate = svc._get_active_candidate_or_404(db, candidate_id)

    # Simulate async LLM call 
    await asyncio.sleep(2)

    scores = candidate.scores
    avg_score = (
        round(sum(s.score for s in scores) / len(scores), 2) if scores else None
    )
    categories = list({s.category for s in scores})

    mock_summary = (
        f"{candidate.name} is applying for the {candidate.role_applied} role. "
        f"They list the following skills: {', '.join(candidate.skills) or 'none provided'}. "
        + (
            f"Across {len(scores)} review(s) in categories ({', '.join(categories)}), "
            f"their average score is {avg_score}/5. "
            if scores
            else "No scores have been submitted yet. "
        )
        + "This summary was auto-generated by the TechKraft AI reviewer (mock)."
    )

    generated_at = datetime.now(timezone.utc)
    svc.save_ai_summary(db, candidate_id, mock_summary)

    return SummaryResponse(
        candidate_id=candidate_id,
        ai_summary=mock_summary,
        generated_at=generated_at,
    )

# Stretch goal: SSE stream of score updates
@router.get(
    "/{candidate_id}/stream",
    summary="[Stretch] SSE stream of real-time score updates for a candidate",
)
async def stream_scores(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Server-Sent Events endpoint.
    Polls the scores table every 3 seconds and pushes new entries to the client.

    A production implementation would use a message broker (Redis Pub/Sub,
    Postgres LISTEN/NOTIFY) instead of polling. This version demonstrates
    the SSE wire format and async generator pattern.
    """
    # Verify candidate exists
    svc._get_active_candidate_or_404(db, candidate_id)

    async def event_generator():
        seen_ids: set[int] = set()
        yield f"data: {json.dumps({'event': 'connected', 'candidate_id': candidate_id})}\n\n"

        for _ in range(20):  # stream for up to ~60 seconds then close
            await asyncio.sleep(3)

            # Refresh scores from DB
            query = db.query(Score).filter(Score.candidate_id == candidate_id)
            if current_user.role != "admin":
                query = query.filter(Score.reviewer_id == current_user.id)

            new_scores = [s for s in query.all() if s.id not in seen_ids]
            for score in new_scores:
                seen_ids.add(score.id)
                payload = {
                    "event": "new_score",
                    "id": score.id,
                    "category": score.category,
                    "score": score.score,
                    "reviewer_id": score.reviewer_id,
                    "created_at": score.created_at.isoformat(),
                }
                yield f"data: {json.dumps(payload)}\n\n"

        yield f"data: {json.dumps({'event': 'stream_closed'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
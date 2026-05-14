"""
tests/test_api.py — API integration tests using FastAPI's TestClient.

Test coverage:
  1. Health check endpoint
  2. Registration always assigns role=reviewer (never from client)
  3. Login returns a valid JWT
  4. Admin can create a candidate
  5. Reviewer cannot see another reviewer's scores (RBAC enforcement)
  6. Reviewer cannot view internal_notes
  7. Soft delete sets status=archived, candidate is not hard-deleted
  8. Pagination and filter parameters are respected

Strategy:
  - Each test gets a fresh in-memory SQLite database via the `db_session`
    fixture, so tests are fully isolated and never touch the real DB file.
  - We override FastAPI's `get_db` dependency to inject the test session.
  - A seeded admin account is created once per test via the `admin_token`
    fixture so we don't repeat boilerplate in every test.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_password_hash
from app.main import app
from app.models import Base, User, get_db

# ---------------------------------------------------------------------------
# Test database setup — in-memory SQLite, isolated per test session
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    """Dependency override: yield a session connected to the in-memory DB."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Apply the override before any test runs
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    """
    Create all tables before each test, drop them after.
    This guarantees full isolation — no state leaks between tests.
    """
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def client():
    """Return a synchronous TestClient wrapping the FastAPI app."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helper: seed users directly into the DB (bypasses HTTP layer)
# ---------------------------------------------------------------------------

def _seed_user(email: str, password: str, role: str) -> User:
    """Insert a user directly into the test DB and return the ORM object."""
    db = TestingSessionLocal()
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _login(client: TestClient, email: str, password: str) -> str:
    """Log in and return the Bearer token string."""
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    """Return an Authorization header dict for use in requests."""
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------------------

def test_health_check(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 2. Registration hardcodes role=reviewer
#    CRITICAL: Even if the client sends {"role": "admin"}, it must be ignored.
# ---------------------------------------------------------------------------

def test_registration_always_assigns_reviewer_role(client):
    # Attempt to register with an explicit admin role in the payload
    payload = {
        "email": "hacker@example.com",
        "password": "password123",
        "role": "admin",          # ← this must be silently ignored
    }
    resp = client.post("/auth/register", json=payload)

    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "hacker@example.com"
    # Server must have assigned "reviewer" regardless of what the client sent
    assert data["role"] == "reviewer", (
        f"SECURITY VIOLATION: server accepted role from client — got '{data['role']}'"
    )


def test_registration_duplicate_email_returns_409(client):
    payload = {"email": "dup@example.com", "password": "password123"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# 3. Login returns a JWT
# ---------------------------------------------------------------------------

def test_login_returns_token(client):
    _seed_user("reviewer@example.com", "password123", "reviewer")
    resp = client.post(
        "/auth/login",
        json={"email": "reviewer@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client):
    _seed_user("reviewer@example.com", "password123", "reviewer")
    resp = client.post(
        "/auth/login",
        json={"email": "reviewer@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 4. Admin can create a candidate
# ---------------------------------------------------------------------------

def test_admin_can_create_candidate(client):
    _seed_user("admin@example.com", "password123", "admin")
    token = _login(client, "admin@example.com", "password123")

    resp = client.post(
        "/candidates",
        json={
            "name": "Alice Smith",
            "email": "alice@example.com",
            "role_applied": "Backend Engineer",
            "skills": ["Python", "FastAPI"],
            "internal_notes": "Referred by CTO",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Alice Smith"
    assert data["status"] == "new"
    # Admin response must include internal_notes
    assert data["internal_notes"] == "Referred by CTO"


def test_reviewer_cannot_create_candidate(client):
    _seed_user("reviewer@example.com", "password123", "reviewer")
    token = _login(client, "reviewer@example.com", "password123")

    resp = client.post(
        "/candidates",
        json={
            "name": "Bob Jones",
            "email": "bob@example.com",
            "role_applied": "Frontend Engineer",
            "skills": ["React"],
        },
        headers=_auth(token),
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. Reviewer CANNOT see another reviewer's scores (core RBAC requirement)
# ---------------------------------------------------------------------------

def test_reviewer_cannot_see_other_reviewers_scores(client):
    """
    Scenario:
      - Admin creates a candidate
      - Reviewer A submits a score
      - Reviewer B fetches the candidate detail
      - Reviewer B's scores list must be EMPTY (cannot see A's score)
    """
    # Seed users
    _seed_user("admin@example.com", "password123", "admin")
    _seed_user("reviewer_a@example.com", "password123", "reviewer")
    _seed_user("reviewer_b@example.com", "password123", "reviewer")

    admin_token = _login(client, "admin@example.com", "password123")
    token_a = _login(client, "reviewer_a@example.com", "password123")
    token_b = _login(client, "reviewer_b@example.com", "password123")

    # Admin creates candidate
    create_resp = client.post(
        "/candidates",
        json={
            "name": "Carol White",
            "email": "carol@example.com",
            "role_applied": "Data Engineer",
            "skills": ["SQL", "Spark"],
        },
        headers=_auth(admin_token),
    )
    assert create_resp.status_code == 201
    candidate_id = create_resp.json()["id"]

    # Reviewer A submits a score
    score_resp = client.post(
        f"/candidates/{candidate_id}/scores",
        json={"category": "Technical", "score": 4, "note": "Strong SQL skills"},
        headers=_auth(token_a),
    )
    assert score_resp.status_code == 201

    # Reviewer B fetches the candidate — must see zero scores
    detail_resp = client.get(
        f"/candidates/{candidate_id}",
        headers=_auth(token_b),
    )
    assert detail_resp.status_code == 200
    scores = detail_resp.json()["scores"]
    assert scores == [], (
        f"RBAC VIOLATION: Reviewer B can see Reviewer A's scores: {scores}"
    )


# ---------------------------------------------------------------------------
# 6. Reviewer cannot see internal_notes
# ---------------------------------------------------------------------------

def test_reviewer_cannot_see_internal_notes(client):
    _seed_user("admin@example.com", "password123", "admin")
    _seed_user("reviewer@example.com", "password123", "reviewer")

    admin_token = _login(client, "admin@example.com", "password123")
    reviewer_token = _login(client, "reviewer@example.com", "password123")

    # Admin creates candidate with internal notes
    create_resp = client.post(
        "/candidates",
        json={
            "name": "Dan Brown",
            "email": "dan@example.com",
            "role_applied": "DevOps Engineer",
            "skills": ["Docker", "K8s"],
            "internal_notes": "Do not hire — failed background check",
        },
        headers=_auth(admin_token),
    )
    assert create_resp.status_code == 201
    candidate_id = create_resp.json()["id"]

    # Reviewer fetches candidate detail
    resp = client.get(f"/candidates/{candidate_id}", headers=_auth(reviewer_token))
    assert resp.status_code == 200
    data = resp.json()

    # internal_notes must NOT be present in the reviewer response
    assert "internal_notes" not in data, (
        "RBAC VIOLATION: internal_notes exposed to reviewer role"
    )


# ---------------------------------------------------------------------------
# 7. Soft delete — candidate is archived, not hard-deleted
# ---------------------------------------------------------------------------

def test_soft_delete_archives_candidate(client):
    _seed_user("admin@example.com", "password123", "admin")
    admin_token = _login(client, "admin@example.com", "password123")

    # Create candidate
    create_resp = client.post(
        "/candidates",
        json={
            "name": "Eve Green",
            "email": "eve@example.com",
            "role_applied": "QA Engineer",
            "skills": ["Selenium"],
        },
        headers=_auth(admin_token),
    )
    assert create_resp.status_code == 201
    candidate_id = create_resp.json()["id"]

    # Delete (soft)
    del_resp = client.delete(f"/candidates/{candidate_id}", headers=_auth(admin_token))
    assert del_resp.status_code == 200

    # Fetching the candidate should now return 404 (filtered by deleted_at IS NULL)
    get_resp = client.get(f"/candidates/{candidate_id}", headers=_auth(admin_token))
    assert get_resp.status_code == 404

    # But the row must still exist in the DB with deleted_at set
    db = TestingSessionLocal()
    from app.models import Candidate
    row = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    db.close()

    assert row is not None, "Hard delete detected — row should still exist in DB"
    assert row.deleted_at is not None, "deleted_at should be set after soft delete"
    assert row.status == "archived", f"Expected status='archived', got '{row.status}'"


# ---------------------------------------------------------------------------
# 8. Pagination is respected
# ---------------------------------------------------------------------------

def test_pagination_limits_results(client):
    _seed_user("admin@example.com", "password123", "admin")
    admin_token = _login(client, "admin@example.com", "password123")

    # Create 5 candidates
    for i in range(5):
        client.post(
            "/candidates",
            json={
                "name": f"Candidate {i}",
                "email": f"candidate{i}@example.com",
                "role_applied": "Engineer",
                "skills": [],
            },
            headers=_auth(admin_token),
        )

    # Request page 1 with page_size=2
    resp = client.get("/candidates?page=1&page_size=2", headers=_auth(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2

    # Request page 3 — only 1 item left
    resp2 = client.get("/candidates?page=3&page_size=2", headers=_auth(admin_token))
    assert resp2.status_code == 200
    assert len(resp2.json()["items"]) == 1


# ---------------------------------------------------------------------------
# 9. Unauthenticated requests are rejected
# ---------------------------------------------------------------------------

def test_unauthenticated_request_returns_403(client):
    # No Authorization header
    resp = client.get("/candidates")
    # HTTPBearer returns 403 when no credentials are provided
    assert resp.status_code in (401, 403)
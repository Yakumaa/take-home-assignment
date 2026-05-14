# TechKraft Recruitment Dashboard

An internal full-stack tool for managing candidate assessments, reviewer scoring, and AI-assisted candidate review. Built with **FastAPI**, **SQLite**, and **React + Vite**.

---

## Table of Contents

1. [Stack](#stack)
2. [Project Structure](#project-structure)
3. [Quick Start](#quick-start)
4. [Running Tests](#running-tests)
5. [Example API Calls](#example-api-calls)
6. [Architecture Decision Records](#architecture-decision-records)
7. [Debugging Challenge](#debugging-challenge)
8. [Learning Reflection](#learning-reflection)

---

## Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Python 3.9, FastAPI, SQLAlchemy, SQLite |
| Auth      | JWT (python-jose), bcrypt (passlib)     |
| Frontend  | React 18, Vite, Tailwind CSS            |
| Container | Docker, Docker Compose                  |
| Testing   | pytest, FastAPI TestClient              |

---

## Project Structure

```
/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py               # FastAPI app factory, CORS, startup
│   │   ├── models.py             # SQLAlchemy ORM models + DB engine
│   │   ├── schemas.py            # Pydantic request/response models
│   │   ├── auth.py               # JWT creation, verification, dependencies
│   │   ├── routers/
│   │   │   ├── auth.py           # POST /auth/register, POST /auth/login
│   │   │   └── candidates.py     # All /candidates/* endpoints
│   │   └── services/
│   │       └── candidate_service.py  # Business logic, RBAC filtering
│   ├── tests/
│       └── test_api.py           # Integration tests (in-memory SQLite)
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.jsx               # Router + AuthProvider root
│   │   ├── api/client.js         # Axios instance + all API functions
│   │   ├── context/AuthContext.jsx
│   │   ├── components/           # Layout, ScoreForm, StatusBadge, guards
│   │   └── pages/                # Login, Register, CandidateList, 
│   ├── package.json
│   └── vite.config.js
```

---

## Quick Start

### Prerequisites

- Docker ≥ 24 and Docker Compose v2
- (Optional, for local dev) Python 3.9+, Node 20+

### 1. Clone and configure

```bash
git clone https://github.com/Yakumaa/take-home-assignment.git
cd take-home-assignment

# Create your local env file from the example
cp .env.example .env
```

Open `.env` and set a strong `SECRET_KEY` using `python -c "import secrets; print(secrets.token_urlsafe(50))"`
. All other defaults work as-is for local development.

### 2. Start both services

```bash
docker compose up --build
```

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:5173     |
| Backend  | http://localhost:8000     |
| API docs | http://localhost:8000/docs |

To run in the background:

```bash
docker compose up --build -d
docker compose logs -f   # tail logs
```

### 3. Seed an admin account

The registration endpoint always creates `reviewer` accounts (by design). Seed an admin directly:

<!-- ```bash
docker compose exec backend python - <<'EOF'
from app.models import SessionLocal, create_tables
from app.auth import get_password_hash
from app.models import User

create_tables()
db = SessionLocal()
if not db.query(User).filter(User.email == "admin@techkraft.com").first():
    db.add(User(
        email="admin@techkraft.com",
        hashed_password=get_password_hash("admin1234"),
        role="admin"
    ))
    db.commit()
    print("Admin seeded.")
else:
    print("Admin already exists.")
db.close()
EOF
``` -->

```bash
docker compose exec backend python -c "from app.models import SessionLocal, User, create_tables; from app.auth import get_password_hash; create_tables(); db = SessionLocal(); existing = db.query(User).filter(User.email == 'admin@techkraft.com').first(); 
if not existing: 
    admin = User(email='admin@techkraft.com', hashed_password=get_password_hash('admin1234'), role='admin'); db.add(admin); db.commit(); print('Admin created.') 
else: 
    print('Admin already exists.'); db.close()"
```

### 4. Open the app

Navigate to **http://localhost:5173**

- Register a reviewer account at `/register`
- Sign in as admin at `/login` with `admin@techkraft.com` / `admin1234`

### Stopping

```bash
docker compose down          # stop containers, keep DB volume
docker compose down -v       # stop containers and wipe DB
```

---

## Running Tests

Tests use an **in-memory SQLite database** — fully isolated, no setup required.

```bash
# Inside Docker (recommended — matches CI environment)
docker compose exec backend pytest

# Locally
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest
```

Expected output:

```
tests/test_api.py::test_health_check                                PASSED
tests/test_api.py::test_registration_always_assigns_reviewer_role   PASSED
tests/test_api.py::test_registration_duplicate_email_returns_409    PASSED
tests/test_api.py::test_login_returns_token                         PASSED
tests/test_api.py::test_login_wrong_password_returns_401            PASSED
tests/test_api.py::test_admin_can_create_candidate                  PASSED
tests/test_api.py::test_reviewer_cannot_create_candidate            PASSED
tests/test_api.py::test_reviewer_cannot_see_other_reviewers_scores  PASSED
tests/test_api.py::test_reviewer_cannot_see_internal_notes          PASSED
tests/test_api.py::test_soft_delete_archives_candidate              PASSED
tests/test_api.py::test_pagination_limits_results                   PASSED
tests/test_api.py::test_unauthenticated_request_returns_403         PASSED

12 passed
```

---

## Example API Calls

### A full Postman collection covering all endpoints is included in the repository:

```/postman/TechKraft_Take-home_Assignment_postman_collection.json```

Import it into Postman and set the following collection variables:

| Variable      | Value                      |
|---------------|----------------------------|
| `base_url`    | `http://localhost:8000`    |
| `admin_token` | *(paste token after login)*|
| `reviewer_token` | *(paste token after login)*|

### Curl Commands

Set up shell variables once, then use them across all commands:
 
```bash
BASE="http://localhost:8000"
 
# Get an admin token
ADMIN_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techkraft.com","password":"admin1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
 
# Get a reviewer token (register first if needed)
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"reviewer@techkraft.com","password":"reviewer1234"}'
 
REVIEWER_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"reviewer@techkraft.com","password":"reviewer1234"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```
 
### Health check
 
```bash
curl "$BASE/health"
# {"status":"ok"}
```
 
### Create a candidate (admin only)
 
```bash
curl -s -X POST "$BASE/candidates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Smith",
    "email": "alice@example.com",
    "role_applied": "Backend Engineer",
    "skills": ["Python", "FastAPI", "Docker"],
    "internal_notes": "Referred by CTO."
  }' | python3 -m json.tool
```
 
### List candidates with filters and pagination
 
```bash
# All candidates, page 1
curl -s "$BASE/candidates?page=1&page_size=10" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | python3 -m json.tool
 
# Filter by status and skill
curl -s "$BASE/candidates?status=new&skill=Python" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | python3 -m json.tool
 
# Keyword search
curl -s "$BASE/candidates?keyword=Alice" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | python3 -m json.tool
```
 
### Get candidate detail
 
```bash
# Reviewer — no internal_notes, only own scores
curl -s "$BASE/candidates/1" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" | python3 -m json.tool
 
# Admin — includes internal_notes and all scores
curl -s "$BASE/candidates/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```
 
### Submit a score
 
```bash
curl -s -X POST "$BASE/candidates/1/scores" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"Technical","score":4,"note":"Strong system design answers."}' \
  | python3 -m json.tool
```
 
### Trigger AI summary (2-second simulated delay)
 
```bash
curl -s -X POST "$BASE/candidates/1/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```
 
### Update candidate status
 
```bash
# Reviewer can update status
curl -s -X PATCH "$BASE/candidates/1" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"reviewed"}' | python3 -m json.tool
 
# Admin can also update internal_notes
curl -s -X PATCH "$BASE/candidates/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"hired","internal_notes":"Offer sent. Start date June 1."}' \
  | python3 -m json.tool
```
 
### Soft delete a candidate (admin only)
 
```bash
curl -s -X DELETE "$BASE/candidates/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# {"detail":"Candidate 1 archived successfully"}
 
# Subsequent GET returns 404 — candidate is hidden but row still exists in DB
curl -s "$BASE/candidates/1" -H "Authorization: Bearer $ADMIN_TOKEN"
```
 
### SSE stream (stretch goal)
 
```bash
# Streams score updates for candidate 1 in real time (~60s window)
curl -N "$BASE/candidates/1/stream" \
  -H "Authorization: Bearer $REVIEWER_TOKEN"
```
---

## Debugging Challenge

### The bug

```python
def search_candidates(status: str, keyword: str, page: int, page_size: int):
    all_candidates = db.execute("SELECT * FROM candidates").fetchall()
    filtered = [c for c in all_candidates if c["status"] == status]
    # ... also filter by keyword in Python ...
    offset = (page - 1) * page_size
    return filtered[offset : offset + page_size]
```

### Three problems

**1. Full table scan into application memory.**
`SELECT * FROM candidates` loads every row before filtering. This bypasses database indexes and becomes expensive as the dataset grows, since the API processes everything in Python memory instead of letting the DB handle filtering.

**2. Python-side filtering breaks pagination correctness.**
The slice `filtered[offset : offset + page_size]` works only after loading the full filtered dataset into memory. It also makes calculating total inefficient because the backend still needs every matching row before pagination.results.

**3. Keyword filtering compounds both problems.**
Filtering keywords in Python means another O(n) pass over the dataset. The database engine is optimized for filtering and searching, so doing this in application code wastes resources.

### The correct approach

Filtering, counting, and pagination should happen directly in SQL through the ORM query.

```python
def search_candidates(
    db: Session,
    status: str,
    keyword: str,
    page: int,
    page_size: int,
) -> PaginatedResponse:
    page_size = min(page_size, 50)           # enforce max page size
    offset    = (page - 1) * page_size

    query = db.query(Candidate).filter(Candidate.deleted_at.is_(None))

    if status:
        query = query.filter(Candidate.status == status)

    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            or_(
                Candidate.name.ilike(kw),
                Candidate.email.ilike(kw),
                Candidate.role_applied.ilike(kw),
            )
        )

    total   = query.count()                  # single COUNT(*) query
    results = query.offset(offset).limit(page_size).all()  # one page only

    return PaginatedResponse(total=total, page=page, page_size=page_size, items=results)
```

This is exactly the implementation in `backend/app/services/candidate_service.py` to`list_candidates`. Key properties:

- Database indexes can be used for filtering (status, deleted_at)
- `COUNT(*)` is executed directly in SQL for an accurate total
- Only one page of results is returned with `LIMIT` and `OFFSET`
- The application avoids unnecessary memory usage and extra Python-side loops

---

## Architecture Decision Records

### ADR 1 — SQLite instead of a DynamoDB-style database

**Context:**
The app mainly works with structured data like candidates and scores, along with filtering and pagination. These kinds of queries are easier to manage in a relational database.

**Decision:**
Used SQLite with SQLAlchemy because it handles relationships, filtering, and querying cleanly with minimal setup.

**Trade-off:**
SQLite is not ideal for very large-scale or high-write systems. It was chosen here because the project is small and simplicity mattered more than scalability.

---

### ADR 2 — Two Pydantic response models for RBAC instead of runtime field nulling

**Context:**
Reviewers should never see `internal_notes`. Using one shared response model could accidentally expose sensitive fields in the future.

**Decision:**
Two distinct Pydantic models were defined: `CandidateResponse` (reviewer-safe, no `internal_notes` field at all) and `CandidateAdminResponse(CandidateResponse)` (extends it with `internal_notes`). The router selects the correct model based on `current_user.role` before serialisation.

**Trade-off:**
This adds a little more code to maintain, but it makes permission handling safer and easier to reason about.

---

### ADR 3 — Stateless JWT auth over server-side sessions

**Context:**
The app runs in Docker containers without shared session storage. Managing server-side sessions would add unnecessary complexity.

**Decision:**
Used stateless JWT authentication with user role information stored inside the token.

**Trade-off:**
JWTs cannot be instantly revoked before expiry without extra infrastructure. For this project, short token expiry was considered enough.

---

## Learning Reflection

This assessment pushed me into territory I hadn't worked in before — FastAPI,
Docker Compose, and wiring a full containerised stack from scratch were all
new to me. Implementing the SSE stream endpoint was also a first. Given more
time, I'd explore Alembic for proper schema migrations, since using
`create_all()` at startup works for a take-home but isn't safe once a real
schema needs versioning.
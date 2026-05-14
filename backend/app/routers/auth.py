"""
routers/auth.py — Registration and login endpoints.

CRITICAL SECURITY CONSTRAINT:
  Registration ALWAYS assigns role = "reviewer".
  The role is NEVER read from the client payload.
  The UserCreate schema intentionally has no `role` field, so even if a
  malicious client sends {"role": "admin"} it is silently ignored by Pydantic.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_password_hash, verify_password
from app.models import User, get_db
from app.schemas import LoginRequest, Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new reviewer account",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """
    Create a new user account.

    **Role is always set to "reviewer" server-side.**
    Any `role` key in the request body is not part of the UserCreate schema
    and is therefore discarded by Pydantic before this function is called.
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role="reviewer",  # ← HARDCODED — never sourced from payload
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="Obtain a JWT access token",
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    """
    Authenticate with email + password and receive a Bearer token.
    The token embeds the user's id and role for downstream RBAC checks.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    # Validate credentials — use constant-time comparison via passlib
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_id=user.id, role=user.role)
    return Token(access_token=token)
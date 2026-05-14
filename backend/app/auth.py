"""
auth.py — JWT creation, verification, password hashing, and FastAPI dependencies.

Flow:
  1. User registers → password hashed with bcrypt, role hardcoded to "reviewer"
  2. User logs in → JWT issued containing {user_id, role}
  3. Protected routes use Depends(get_current_user) to get the authenticated User ORM object
  4. Admin-only routes use Depends(require_admin) which calls get_current_user first
"""

import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models import User, get_db
from app.schemas import TokenData

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SECRET_KEY: str = os.getenv("SECRET_KEY", "insecure-default-key-change-in-production")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, role: str) -> str:
    """
    Issue a signed JWT containing the user's id and role.
    The role is embedded at token creation time (server-controlled),
    never sourced from a client request.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """Decode and validate a JWT, returning typed TokenData."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id_str is None or role is None:
            raise credentials_exception
        return TokenData(user_id=int(user_id_str), role=role)
    except JWTError:
        raise credentials_exception


# ---------------------------------------------------------------------------
# FastAPI security scheme
# ---------------------------------------------------------------------------

# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Reusable dependencies
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: decode the Bearer token and return the authenticated User ORM object.
    Raises 401 if the token is invalid or the user no longer exists.
    """
    token_data = decode_token(credentials.credentials)
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency: same as get_current_user but additionally enforces admin role.
    Raises 403 Forbidden if the authenticated user is not an admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
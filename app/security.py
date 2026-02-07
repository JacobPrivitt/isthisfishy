from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from app.config import INVITE_REQUIRED


DEV_AUTH_HEADER = "Bearer dev"


class AuthUser:
    def __init__(self, clerk_user_id: str, email: str):
        self.clerk_user_id = clerk_user_id
        self.email = email


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def require_invite(invite_code: str | None) -> None:
    if not INVITE_REQUIRED:
        return
    if not invite_code:
        raise ValueError("Invite code required")


def get_auth_user_from_header(authorization: Optional[str]) -> Optional[AuthUser]:
    if authorization == DEV_AUTH_HEADER:
        return AuthUser(clerk_user_id="dev_user", email="dev@local")
    return None


def require_auth_user(authorization: Optional[str]) -> AuthUser:
    user = get_auth_user_from_header(authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user

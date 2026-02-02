from datetime import datetime, timezone
from app.config import INVITE_REQUIRED

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def require_invite(invite_code: str | None) -> None:
    if not INVITE_REQUIRED:
        return
    if not invite_code:
        raise ValueError("Invite code required")

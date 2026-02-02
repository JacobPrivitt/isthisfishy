import json
import uuid
from fastapi import FastAPI, HTTPException, Header
from redis import Redis
from rq import Queue

from app.config import REDIS_URL, ADMIN_KEY, INVITE_REQUIRED
from app.db import init_db, get_conn
from app.models import SubmitRequest, SubmitResponse, CheckResult
from app.security import utcnow_iso, require_invite
from app.tasks import process_check

app = FastAPI(title="IsThisFishy API", version="0.1.0")

redis_conn = Redis.from_url(REDIS_URL)
queue = Queue("default", connection=redis_conn)

@app.on_event("startup")
def startup():
    init_db()

def _validate_invite(invite_code: str) -> None:
    with get_conn() as conn:
        row = conn.execute("SELECT code, used_at FROM invites WHERE code=?", (invite_code,)).fetchone()
        if row is None:
            raise ValueError("Invalid invite code")
        if row["used_at"] is not None:
            raise ValueError("Invite code already used")

def _mark_invite_used(invite_code: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE invites SET used_at=? WHERE code=?",
            (utcnow_iso(), invite_code),
        )

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/submit", response_model=SubmitResponse)
def submit(req: SubmitRequest):
    try:
        require_invite(req.invite_code)
        if INVITE_REQUIRED:
            _validate_invite(req.invite_code or "")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    check_id = str(uuid.uuid4())
    created_at = utcnow_iso()

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO checks (id, created_at, status, input_type, input_value, invite_code)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (check_id, created_at, "queued", req.input_type, req.input_value, req.invite_code),
        )

    if INVITE_REQUIRED and req.invite_code:
        _mark_invite_used(req.invite_code)

    queue.enqueue(process_check, check_id)

    return SubmitResponse(check_id=check_id, status="queued")

@app.get("/checks/{check_id}", response_model=CheckResult)
def get_check(check_id: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM checks WHERE id=?", (check_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Not found")

    reasons = json.loads(row["reasons_json"]) if row["reasons_json"] else None
    actions = json.loads(row["actions_json"]) if row["actions_json"] else None

    return CheckResult(
        id=row["id"],
        status=row["status"],
        input_type=row["input_type"],
        input_value=row["input_value"],
        risk_score=row["risk_score"],
        risk_level=row["risk_level"],
        category=row["category"],
        reasons=reasons,
        recommended_actions=actions,
        explanation=row["explanation"],
        error=row["error"],
    )

@app.post("/admin/invites")
def create_invite(x_admin_key: str = Header(default="")):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

    code = uuid.uuid4().hex[:10]
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO invites (code, created_at, used_at) VALUES (?, ?, ?)",
            (code, utcnow_iso(), None),
        )
    return {"invite_code": code}

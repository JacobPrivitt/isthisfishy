import json
import uuid

from fastapi import FastAPI, HTTPException, Header
from redis import Redis
from dotenv import load_dotenv
load_dotenv()
from rq import Queue

from app.ai_provider import OpenAIProviderError, analyze_text
from app.config import ADMIN_KEY, INVITE_REQUIRED, OPENAI_API_KEY, REDIS_URL
from app.db import get_conn, init_db
from app.models import AnalyzeRequest, CheckResult, FishyAssessment, InputType, PrimaryAction, SubmitRequest, SubmitResponse, Verdict
from app.security import require_invite, utcnow_iso
from app.tasks import process_check


app = FastAPI(title="IsThisFishy API", version="0.1.0")

redis_conn = Redis.from_url(REDIS_URL)
queue = Queue("default", connection=redis_conn)


@app.on_event("startup")
def startup():
    init_db()
    if not OPENAI_API_KEY:
        print("WARNING: OPENAI_API_KEY is not set. /analyze will use fallback local analysis.")


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
            (check_id, created_at, "queued", req.input_type.value, req.input_value, req.invite_code),
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


def _clamp(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "..."


def _enforce_action_alignment(verdict: Verdict) -> PrimaryAction:
    if verdict == Verdict.very_likely_scam:
        return PrimaryAction.do_not_reply_or_pay
    if verdict == Verdict.probably_legit:
        return PrimaryAction.continue_carefully
    return PrimaryAction.pause_and_verify


@app.post("/analyze", response_model=FishyAssessment)
def analyze_endpoint(req: AnalyzeRequest):
    if req.input_type != InputType.text:
        raise HTTPException(status_code=400, detail="MVP supports text only for now.")
    if not req.content_text.strip():
        raise HTTPException(status_code=400, detail="content_text is required.")

    request_id = str(uuid.uuid4())

    try:
        ai_raw = analyze_text(req.content_text)
    except OpenAIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

    reasons = [_clamp(r, 120) for r in ai_raw.reasons][:3]
    if not reasons:
        reasons = ["Some details don't fully line up."]

    ai_raw.recommended_next_step.primary_action = _enforce_action_alignment(ai_raw.risk_level)
    ai_raw.recommended_next_step.supporting_text = _clamp(ai_raw.recommended_next_step.supporting_text, 180)

    share_controls = {"is_shareable": True, "default_share": (req.mode.value != "private")}

    return FishyAssessment(
        request_id=request_id,
        created_at=FishyAssessment.now_utc(),
        mode=req.mode,
        input_type=req.input_type,
        verdict=ai_raw.risk_level,
        confidence=ai_raw.confidence,
        category=ai_raw.category,
        romance_indicators=ai_raw.romance_indicators,
        reasons=reasons,
        recommended_next_step=ai_raw.recommended_next_step,
        safety_notes=[],
        share_controls=share_controls,
    )

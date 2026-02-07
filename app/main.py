import json
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Header, Request
from redis import Redis
from dotenv import load_dotenv
load_dotenv()
from rq import Queue

from app.ai_provider import OpenAIProviderError, analyze_text
from app.config import ADMIN_KEY, INVITE_REQUIRED, OPENAI_API_KEY, REDIS_URL
from app.db import get_conn, init_db
from app.models import AnalyzeRequest, CheckResult, FishyAssessment, InputType, PrimaryAction, RedeemRequest, RedeemResponse, SubmitRequest, SubmitResponse, Verdict
from app.security import get_auth_user_from_header, require_auth_user, require_invite, utcnow_iso
from app.tasks import process_check


app = FastAPI(title="IsThisFishy API", version="0.1.0")
ANON_PRIVATE_DAILY_LIMIT = 5

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
    except ValueError:
        raise HTTPException(status_code=401, detail="Please use a valid invite code.")

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


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _is_expired(value: str | None) -> bool:
    expires_at = _parse_iso_datetime(value)
    if expires_at is None:
        return False
    return expires_at <= datetime.now(timezone.utc)


def _get_or_create_user(conn, clerk_user_id: str, email: str):
    row = conn.execute(
        "SELECT id, clerk_user_id, email FROM users WHERE clerk_user_id=?",
        (clerk_user_id,),
    ).fetchone()
    if row:
        return row

    conn.execute(
        "INSERT INTO users (clerk_user_id, email, created_at) VALUES (?, ?, ?)",
        (clerk_user_id, email, utcnow_iso()),
    )
    return conn.execute(
        "SELECT id, clerk_user_id, email FROM users WHERE clerk_user_id=?",
        (clerk_user_id,),
    ).fetchone()


def _has_active_family_entitlement(clerk_user_id: str) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT e.plan, e.status, e.expires_at
            FROM entitlements e
            JOIN users u ON u.id = e.user_id
            WHERE u.clerk_user_id = ?
            """,
            (clerk_user_id,),
        ).fetchone()
    if row is None:
        return False
    if row["status"] != "active":
        return False
    if row["plan"] != "family":
        return False
    return not _is_expired(row["expires_at"])


def _enforce_anonymous_private_limit(request: Request) -> None:
    ip_address = request.client.host if request.client else "unknown"
    day = datetime.now(timezone.utc).date().isoformat()

    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO usage_counters (ip_address, day, count, created_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(ip_address, day) DO UPDATE SET count = usage_counters.count + 1
            RETURNING count
            """,
            (ip_address, day, utcnow_iso()),
        ).fetchone()

        if int(row["count"]) > ANON_PRIVATE_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="You have reached today's free limit. Please try again tomorrow.")


@app.post("/redeem", response_model=RedeemResponse)
def redeem_license(
    req: RedeemRequest,
    authorization: str | None = Header(default=None),
):
    auth_user = require_auth_user(authorization)
    license_key = "".join(req.license_key.split()).upper()
    now_iso = utcnow_iso()

    with get_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        user = _get_or_create_user(conn, auth_user.clerk_user_id, auth_user.email)
        license_row = conn.execute(
            "SELECT * FROM license_keys WHERE key=?",
            (license_key,),
        ).fetchone()

        if license_row is None:
            raise HTTPException(status_code=400, detail="Invalid license key")
        if license_row["status"] != "unused":
            raise HTTPException(status_code=400, detail="License key already used")
        if _is_expired(license_row["expires_at"]):
            raise HTTPException(status_code=400, detail="License key expired")

        entitlement_row = conn.execute(
            "SELECT id, plan, status, expires_at FROM entitlements WHERE user_id=?",
            (user["id"],),
        ).fetchone()

        if entitlement_row is None:
            conn.execute(
                """
                INSERT INTO entitlements (user_id, plan, status, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user["id"], license_row["plan"], "active", license_row["expires_at"], now_iso),
            )
        else:
            existing_is_active = entitlement_row["status"] == "active" and not _is_expired(entitlement_row["expires_at"])
            if existing_is_active and entitlement_row["plan"] != license_row["plan"]:
                raise HTTPException(status_code=400, detail="You already have an active plan.")

            existing_exp = _parse_iso_datetime(entitlement_row["expires_at"])
            new_exp = _parse_iso_datetime(license_row["expires_at"])
            merged_exp = entitlement_row["expires_at"]
            if existing_exp is None:
                merged_exp = entitlement_row["expires_at"]
            elif new_exp is None or new_exp > existing_exp:
                merged_exp = license_row["expires_at"]

            conn.execute(
                """
                UPDATE entitlements
                SET plan=?, status=?, expires_at=?
                WHERE user_id=?
                """,
                (license_row["plan"], "active", merged_exp, user["id"]),
            )

        conn.execute(
            """
            UPDATE license_keys
            SET status=?, redeemed_by_user_id=?, redeemed_at=?
            WHERE id=?
            """,
            ("redeemed", user["id"], now_iso, license_row["id"]),
        )

    return RedeemResponse(
        ok=True,
        plan=license_row["plan"],
        expires_at=license_row["expires_at"],
        status="active",
    )


@app.post("/analyze", response_model=FishyAssessment)
def analyze_endpoint(
    req: AnalyzeRequest,
    request: Request,
    authorization: str | None = Header(default=None),
):
    if req.input_type != InputType.text:
        raise HTTPException(status_code=400, detail="MVP supports text only for now.")
    if not req.content_text.strip():
        raise HTTPException(status_code=400, detail="content_text is required.")

    auth_user = get_auth_user_from_header(authorization)
    if auth_user is None:
        if req.mode.value != "private":
            raise HTTPException(status_code=401, detail="Please sign in to use this mode.")
        _enforce_anonymous_private_limit(request)
    else:
        if req.mode.value == "family" and not _has_active_family_entitlement(auth_user.clerk_user_id):
            raise HTTPException(status_code=402, detail="Family mode is part of the family plan.")

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

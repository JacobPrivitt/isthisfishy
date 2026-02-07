from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SubmitInputType(str, Enum):
    text = "text"
    url = "url"


class SubmitRequest(BaseModel):
    invite_code: Optional[str] = Field(default=None, description="Required if invite gate enabled")
    input_type: SubmitInputType
    input_value: str = Field(min_length=1, max_length=5000)


class SubmitResponse(BaseModel):
    check_id: str
    status: Literal["queued", "processing", "done", "error"]


class CheckResult(BaseModel):
    id: str
    status: Literal["queued", "processing", "done", "error"]
    input_type: SubmitInputType
    input_value: str
    risk_score: Optional[int] = None
    risk_level: Optional[Literal["low", "medium", "high"]] = None
    category: Optional[str] = None
    reasons: Optional[List[str]] = None
    recommended_actions: Optional[List[str]] = None
    explanation: Optional[str] = None
    error: Optional[str] = None


class Mode(str, Enum):
    private = "private"
    shared = "shared"
    family = "family"


class InputType(str, Enum):
    text = "text"
    image = "image"
    mixed = "mixed"


class Verdict(str, Enum):
    very_likely_scam = "very_likely_scam"
    suspicious = "suspicious"
    probably_legit = "probably_legit"


class Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Category(str, Enum):
    romance = "romance"
    impersonation = "impersonation"
    payment = "payment"
    job = "job"
    tech_support = "tech_support"
    prize = "prize"
    charity = "charity"
    account_takeover = "account_takeover"
    investment = "investment"
    other = "other"
    unknown = "unknown"


class PrimaryAction(str, Enum):
    do_not_reply_or_pay = "do_not_reply_or_pay"
    pause_and_verify = "pause_and_verify"
    continue_carefully = "continue_carefully"


class RomanceIndicators(BaseModel):
    present: bool = False
    signals: List[str] = Field(default_factory=list, max_length=8)
    severity: Optional[Literal["low", "medium", "high"]] = None


class RecommendedNextStep(BaseModel):
    primary_action: PrimaryAction
    supporting_text: str = Field(max_length=180)


class AnalyzeRequest(BaseModel):
    mode: Mode = Mode.private
    input_type: InputType = InputType.text
    content_text: str = Field(default="", max_length=8000)


class RedeemRequest(BaseModel):
    license_key: str = Field(min_length=1, max_length=64)


class RedeemResponse(BaseModel):
    ok: bool
    plan: str
    expires_at: Optional[str] = None
    status: Literal["active"]


class ShareRequest(BaseModel):
    analysis_result: dict
    share_ttl_hours: int = Field(default=72, ge=1, le=720)


class FamilyInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class AiRawResult(BaseModel):
    risk_level: Verdict
    confidence: Confidence
    category: Category
    romance_indicators: RomanceIndicators
    reasons: List[str] = Field(min_length=1, max_length=3)
    red_flags: List[str] = Field(default_factory=list, max_length=10)
    recommended_next_step: RecommendedNextStep


class FishyAssessment(BaseModel):
    request_id: str
    created_at: datetime

    mode: Mode
    input_type: InputType

    verdict: Verdict
    confidence: Confidence
    category: Category
    romance_indicators: RomanceIndicators

    reasons: List[str]
    recommended_next_step: RecommendedNextStep

    safety_notes: List[str] = Field(default_factory=list)
    share_controls: dict = Field(default_factory=lambda: {"is_shareable": True, "default_share": False})
    verdict_label: str = ""
    next_action: str = ""
    scam_type: str = ""

    @staticmethod
    def now_utc() -> datetime:
        return datetime.now(timezone.utc)


class V1Verdict(str, Enum):
    very_likely_scam = "very_likely_scam"
    likely_scam = "likely_scam"
    unclear = "unclear"
    likely_safe = "likely_safe"


class V1Confidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ErrorCode(str, Enum):
    UNAUTHORIZED = "UNAUTHORIZED"
    PAYWALL = "PAYWALL"
    RATE_LIMIT = "RATE_LIMIT"
    BAD_REQUEST = "BAD_REQUEST"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL = "INTERNAL"


class AnalyzeV1Request(BaseModel):
    mode: Mode = Mode.private
    input_type: Literal["text"] = "text"
    content_text: str = Field(default="", max_length=8000)


class AnalyzeV1Share(BaseModel):
    available: bool
    token: Optional[str] = None
    url: Optional[str] = None


class AnalyzeV1Family(BaseModel):
    event_created: bool
    group_id: Optional[str] = None


class AnalyzeV1Response(BaseModel):
    request_id: str
    mode: Mode
    verdict: V1Verdict
    confidence: V1Confidence
    scam_type: str
    reasons: List[str]
    next_action: str
    summary: str
    share: AnalyzeV1Share
    family: AnalyzeV1Family


class RedeemV1Response(BaseModel):
    request_id: str
    ok: bool
    plan: str
    expires_at: Optional[str] = None
    status: Literal["active"]


class ShareV1Request(BaseModel):
    analysis_result: AnalyzeV1Response
    share_ttl_hours: int = Field(default=72, ge=1, le=720)


class ShareV1Response(BaseModel):
    request_id: str
    ok: bool
    token: str
    url: str
    expires_at: str


class FamilyCreateV1Response(BaseModel):
    request_id: str
    ok: bool
    group_id: str


class FamilyInviteV1Response(BaseModel):
    request_id: str
    ok: bool


class FamilyAcceptV1Response(BaseModel):
    request_id: str
    ok: bool


class FamilyMemberV1(BaseModel):
    email: str
    role: str
    status: str


class FamilyMembersV1Response(BaseModel):
    request_id: str
    ok: bool
    members: List[FamilyMemberV1]


class FamilyEventV1(BaseModel):
    created_at: str
    verdict: str
    confidence: str
    scam_type: str
    reasons: List[str]
    next_action: str


class FamilyEventsV1Response(BaseModel):
    request_id: str
    ok: bool
    events: List[FamilyEventV1]


class ErrorPayload(BaseModel):
    code: ErrorCode
    message: str


class ErrorResponse(BaseModel):
    request_id: str
    error: ErrorPayload

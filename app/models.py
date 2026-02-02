from typing import Literal, Optional, List
from pydantic import BaseModel, Field

InputType = Literal["text", "url"]

class SubmitRequest(BaseModel):
    invite_code: Optional[str] = Field(default=None, description="Required if invite gate enabled")
    input_type: InputType
    input_value: str = Field(min_length=1, max_length=5000)

class SubmitResponse(BaseModel):
    check_id: str
    status: Literal["queued", "processing", "done", "error"]

class CheckResult(BaseModel):
    id: str
    status: Literal["queued", "processing", "done", "error"]
    input_type: InputType
    input_value: str
    risk_score: Optional[int] = None
    risk_level: Optional[Literal["low", "medium", "high"]] = None
    category: Optional[str] = None
    reasons: Optional[List[str]] = None
    recommended_actions: Optional[List[str]] = None
    explanation: Optional[str] = None
    error: Optional[str] = None

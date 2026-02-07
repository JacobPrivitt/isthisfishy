import json
from dataclasses import dataclass
from typing import List

from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models import (
    AiRawResult,
    Category,
    Confidence,
    PrimaryAction,
    RecommendedNextStep,
    RomanceIndicators,
    Verdict,
)

client = OpenAI(api_key=OPENAI_API_KEY)


class OpenAIProviderError(RuntimeError):
    pass


SYSTEM_INSTRUCTIONS = (
    "You are IsThisFishy, a calm second-opinion assistant that evaluates whether content is likely a scam. "
    "Be non-judgmental, avoid technical jargon, keep reasons short. "
    "Return ONLY JSON that matches the provided schema."
)


@dataclass
class Analysis:
    risk_score: int
    risk_level: str
    category: str
    reasons: List[str]
    recommended_actions: List[str]
    explanation: str


def analyze(input_type: str, input_value: str) -> Analysis:
    text = input_value.lower()

    scam_signals = [
        "gift card",
        "wire transfer",
        "crypto",
        "urgent",
        "act now",
        "verify your account",
        "password",
        "ssn",
        "social security",
        "bank login",
        "one-time code",
        "otp",
        "microsoft support",
        "refund",
        "invoice overdue",
        "click here",
        "limited time",
        "suspicious",
    ]

    hits = [s for s in scam_signals if s in text]
    score = min(90, 15 + len(hits) * 12)

    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    category = "possible scam" if hits else "unknown"

    reasons = []
    if hits:
        reasons.append(f"Matched scam keywords: {', '.join(hits[:6])}")
    if input_type == "url" and any(x in text for x in ["bit.ly", "tinyurl", "t.co"]):
        reasons.append("Shortened link can hide the real destination")

    if not reasons:
        reasons = ["No strong scam signals detected in this quick pass"]

    actions = [
        "Do not click links or reply with personal info",
        "Verify using an official phone number or website you type in yourself",
        "Ask a family member or caregiver to review before acting",
    ]

    explanation = (
        "This is a quick risk check. It can be wrong. "
        "If anything feels urgent or asks for money or codes, slow down and verify."
    )

    return Analysis(
        risk_score=score,
        risk_level=level,
        category=category,
        reasons=reasons,
        recommended_actions=actions,
        explanation=explanation,
    )


def _fallback_ai_result(content_text: str) -> AiRawResult:
    baseline = analyze("text", content_text)

    if baseline.risk_level == "high":
        verdict = Verdict.very_likely_scam
        confidence = Confidence.high
    elif baseline.risk_level == "medium":
        verdict = Verdict.suspicious
        confidence = Confidence.medium
    else:
        verdict = Verdict.probably_legit
        confidence = Confidence.low

    return AiRawResult(
        risk_level=verdict,
        confidence=confidence,
        category=Category.other if baseline.category != "unknown" else Category.unknown,
        romance_indicators=RomanceIndicators(present=False, signals=[], severity=None),
        reasons=baseline.reasons[:3],
        red_flags=baseline.reasons[:10],
        recommended_next_step=RecommendedNextStep(
            primary_action=PrimaryAction.pause_and_verify,
            supporting_text="Pause and verify details through an official source before taking action.",
        ),
    )


def analyze_text(content_text: str) -> AiRawResult:
    if not OPENAI_API_KEY:
        print("[analyze] provider=fallback reason=missing_openai_api_key")
        return _fallback_ai_result(content_text)

    schema = AiRawResult.model_json_schema()
    schema_json = json.dumps(schema, ensure_ascii=True)

    try:
        print(f"[analyze] provider=openai model={OPENAI_MODEL}")
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTIONS},
                {
                    "role": "user",
                    "content": (
                        "Analyze the following text and return only JSON that validates against "
                        f"this schema: {schema_json}\n\nText:\n{content_text}"
                    ),
                },
            ],
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
        return AiRawResult.model_validate_json(raw)
    except Exception as e:
        # Do not silently fall back when a key is configured.
        msg = f"OpenAI request failed: {type(e).__name__}: {e}"
        print(f"[analyze] provider=openai error={msg}")
        raise OpenAIProviderError(msg) from e

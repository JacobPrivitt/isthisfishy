import json
from app.db import get_conn
from app.security import utcnow_iso
from app.ai_provider import analyze

def process_check(check_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE checks SET status=? WHERE id=?",
            ("processing", check_id),
        )

    try:
        with get_conn() as conn:
            row = conn.execute("SELECT * FROM checks WHERE id=?", (check_id,)).fetchone()
            if row is None:
                return
            input_type = row["input_type"]
            input_value = row["input_value"]

        result = analyze(input_type, input_value)

        with get_conn() as conn:
            conn.execute(
                """
                UPDATE checks
                SET status=?, risk_score=?, risk_level=?, category=?,
                    reasons_json=?, actions_json=?, explanation=?, error=?
                WHERE id=?
                """,
                (
                    "done",
                    int(result.risk_score),
                    result.risk_level,
                    result.category,
                    json.dumps(result.reasons),
                    json.dumps(result.recommended_actions),
                    result.explanation,
                    None,
                    check_id,
                ),
            )
    except Exception as e:
        with get_conn() as conn:
            conn.execute(
                "UPDATE checks SET status=?, error=? WHERE id=?",
                ("error", str(e), check_id),
            )

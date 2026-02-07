import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
os.environ["ENV"] = "dev"
os.environ["OPENAI_API_KEY"] = ""

from app.config import DATABASE_PATH  # noqa: E402
from app.main import app  # noqa: E402


def _reset_db() -> None:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("DELETE FROM usage_counters")
    conn.execute("DELETE FROM share_links")
    conn.execute("DELETE FROM family_events")
    conn.execute("DELETE FROM family_members")
    conn.execute("DELETE FROM family_groups")
    conn.execute("DELETE FROM entitlements")
    conn.execute("DELETE FROM users")
    conn.execute("DELETE FROM license_keys")
    conn.commit()
    conn.close()


def _seed_license(key: str, plan: str = "family") -> None:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute(
        """
        INSERT INTO license_keys (key, plan, status, expires_at, redeemed_by_user_id, redeemed_at, created_at)
        VALUES (?, ?, 'unused', ?, NULL, NULL, ?)
        """,
        (
            key,
            plan,
            (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def _count(table: str) -> int:
    conn = sqlite3.connect(DATABASE_PATH)
    value = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    conn.close()
    return int(value)


def _assert_no_content_columns(table: str) -> None:
    conn = sqlite3.connect(DATABASE_PATH)
    cols = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    conn.close()
    if "content_text" in cols:
        raise AssertionError(f"{table} should not include content_text")


def main() -> None:
    _reset_db()
    client = TestClient(app)

    # Private mode: no share/family artifacts besides usage counters.
    private_res = client.post(
        "/api/v1/analyze",
        json={"mode": "private", "input_type": "text", "content_text": "hello"},
    )
    assert private_res.status_code in (200, 502)
    assert _count("share_links") == 0
    assert _count("family_events") == 0
    assert _count("usage_counters") >= 1

    # Shared mode: create share link and ensure no content storage.
    shared_res = client.post(
        "/api/v1/analyze",
        headers={"Authorization": "Bearer dev"},
        json={"mode": "shared", "input_type": "text", "content_text": "do not store this text"},
    )
    assert shared_res.status_code in (200, 502)
    analysis_result = shared_res.json() if shared_res.status_code == 200 else {
        "mode": "shared",
        "request_id": "fallback",
        "verdict": "likely_scam",
        "confidence": "medium",
        "scam_type": "unknown",
        "reasons": ["Looks unusual.", "Please verify with someone you trust."],
        "next_action": "Pause and verify details with a trusted source.",
        "summary": "Looks suspicious. Pause and verify details with a trusted source.",
        "share": {"available": True, "token": None, "url": None},
        "family": {"event_created": False, "group_id": None},
    }
    share_res = client.post(
        "/api/v1/share",
        headers={"Authorization": "Bearer dev"},
        json={"analysis_result": analysis_result, "share_ttl_hours": 1},
    )
    assert share_res.status_code == 200
    assert _count("share_links") == 1
    _assert_no_content_columns("share_links")

    # Family blocked when unpaid.
    unpaid_family_res = client.post(
        "/api/v1/analyze",
        headers={"Authorization": "Bearer dev"},
        json={"mode": "family", "input_type": "text", "content_text": "family check"},
    )
    assert unpaid_family_res.status_code == 402

    # Redeem family and verify family event created without content_text.
    _seed_license("FISHY-ABCD-EFGH", "family")
    redeem_res = client.post(
        "/api/v1/redeem",
        headers={"Authorization": "Bearer dev"},
        json={"license_key": "FISHY-ABCD-EFGH"},
    )
    assert redeem_res.status_code == 200

    family_res = client.post(
        "/api/v1/analyze",
        headers={"Authorization": "Bearer dev"},
        json={"mode": "family", "input_type": "text", "content_text": "never store this"},
    )
    assert family_res.status_code in (200, 502)
    assert _count("family_events") >= 1
    _assert_no_content_columns("family_events")

    # Share expiry check
    share_payload = share_res.json()
    token = share_payload["token"]
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute(
        "UPDATE share_links SET expires_at=? WHERE token=?",
        ((datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), token),
    )
    conn.commit()
    conn.close()
    expired_res = client.get(f"/api/v1/s/{token}")
    assert expired_res.status_code == 404

    print("Verification passed.")


if __name__ == "__main__":
    main()

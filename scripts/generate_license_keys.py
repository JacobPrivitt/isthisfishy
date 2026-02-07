import argparse
import random
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, init_db
from app.security import utcnow_iso

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def build_key() -> str:
    left = "".join(random.choice(ALPHABET) for _ in range(4))
    right = "".join(random.choice(ALPHABET) for _ in range(4))
    return f"FISHY-{left}-{right}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and store IsThisFishy license keys")
    parser.add_argument("--count", type=int, required=True, help="Number of keys to generate")
    parser.add_argument("--plan", type=str, required=True, help="Plan name for generated keys")
    parser.add_argument("--days", type=int, required=True, help="Days until key expiration")
    args = parser.parse_args()

    if args.count <= 0:
        raise SystemExit("--count must be greater than 0")
    if args.days <= 0:
        raise SystemExit("--days must be greater than 0")

    init_db()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=args.days)).isoformat()
    created_at = utcnow_iso()

    generated_keys: list[str] = []
    with get_conn() as conn:
        while len(generated_keys) < args.count:
            key = build_key()
            try:
                conn.execute(
                    """
                    INSERT INTO license_keys (key, plan, status, expires_at, redeemed_by_user_id, redeemed_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (key, args.plan, "unused", expires_at, None, None, created_at),
                )
                generated_keys.append(key)
            except sqlite3.IntegrityError:
                # Key collisions are rare; try another key.
                continue

    for key in generated_keys:
        print(key)


if __name__ == "__main__":
    main()

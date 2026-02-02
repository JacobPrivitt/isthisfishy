import os
import sqlite3
from contextlib import contextmanager
from app.config import DATABASE_PATH

def ensure_db_dir() -> None:
    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

@contextmanager
def get_conn():
    ensure_db_dir()
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS invites (
                code TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                used_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS checks (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                input_type TEXT NOT NULL,
                input_value TEXT NOT NULL,
                risk_score INTEGER,
                risk_level TEXT,
                category TEXT,
                reasons_json TEXT,
                actions_json TEXT,
                explanation TEXT,
                error TEXT,
                invite_code TEXT
            )
            """
        )

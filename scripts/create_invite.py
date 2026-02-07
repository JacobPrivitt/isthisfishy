import os
import sys
from pathlib import Path

import requests

sys.path.append(str(Path(__file__).resolve().parents[1]))

ADMIN_KEY = os.getenv("ADMIN_KEY", "change-me")

if __name__ == "__main__":
    r = requests.post(
        "http://127.0.0.1:8000/admin/invites",
        headers={"X-Admin-Key": ADMIN_KEY},
        timeout=10,
    )
    print(r.status_code, r.text)

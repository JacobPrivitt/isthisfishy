# IsThisFishy (beta ground break)

FastAPI + RQ + SQLite starter for invite-only scam checks.

## Prereqs
- Python 3.11+
- Redis running locally

## Setup
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt

copy .env.example .env  # Windows
# cp .env.example .env  # macOS/Linux

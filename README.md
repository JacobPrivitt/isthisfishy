# IsThisFishy Backend

FastAPI + SQLite backend for scam-content analysis with a simple license-key paywall.

## Placeholder auth (non-prod only)
- `Authorization: Bearer dev` maps to `dev_user`.
- Optional demo token from `.env`:
  - `DEMO_AUTH_TOKEN=replace-me`
  - `DEMO_AUTH_USER_ID=demo_user`
  - `DEMO_AUTH_EMAIL=demo@local`
- Set `ENV=prod` to disable all placeholder bearer auth (`dev` + demo token).

## Run locally
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r reqs.txt
python scripts/init_db.py
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/` to use the web UI.
- Paste text and click **Check Message**.
- Use **Signed in (dev)** to simulate authenticated requests.
- If Family mode is locked, redeem a code in the **Unlock Family Protection** panel.

## Generate license keys
```bash
python scripts/generate_license_keys.py --count 10 --plan family --days 30
```

## Redeem a key (dev auth)
```bash
curl -X POST "http://127.0.0.1:8000/redeem" ^
  -H "Authorization: Bearer dev" ^
  -H "Content-Type: application/json" ^
  -d "{\"license_key\":\"FISHY-ABCD-EFGH\"}"
```

## Modes and paywall rules
- `private` is always available.
- Anonymous users can only use `private`.
- Anonymous `private` has a per-IP daily limit (default `5`).
- Authenticated users without paid entitlement can use `private` and `shared`.
- `family` mode requires an active `family` entitlement.
- Redeeming a valid, unexpired license key activates entitlement on the authenticated user.
- Expired or already redeemed keys are rejected.

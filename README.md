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

## Testing key reset (local)
Generate one fresh Family key:
```bash
python scripts/generate_license_keys.py --count 1 --plan family --days 30
```

Revoke an old key and clear `dev_user` entitlement so Family is locked again:
```bash
python -c "import sqlite3; from app.config import DATABASE_PATH; c=sqlite3.connect(DATABASE_PATH); cur=c.cursor(); cur.execute(\"UPDATE license_keys SET status='revoked' WHERE key=?\", ('FISHY-REPLACE-ME',)); cur.execute(\"DELETE FROM entitlements WHERE user_id=(SELECT id FROM users WHERE clerk_user_id='dev_user')\"); c.commit(); c.close(); print('Done')"
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

## Mode definitions
- `private`: Just for you. Not saved or shared.
- `shared`: Create a short summary link you can send to someone you trust.
- `family`: Shares result metadata with your linked family members. Requires Family Protection.

## What is stored (and not stored)
- We do not store pasted `content_text` from `/analyze`.
- `shared` stores summary metadata only (`verdict`, `confidence`, `scam_type`, `reasons`, `next_action`) in `share_links`.
- `family` stores event metadata only (`verdict`, `confidence`, `scam_type`, `reasons`, `next_action`) in `family_events`.
- `private` does not create share links or family events.
- Anonymous private usage increments `usage_counters` per IP/day.

## Test shared links locally
1. Run an analysis in `shared` mode while signed in (`Bearer dev` in current UI).
2. Click **Create Share Link** in the Shared panel.
3. Open the generated URL (`/s/<token>`).
4. To test expiry, run `python scripts/verify_mode_storage.py`.

## Test family workflow locally
1. Redeem a `family` license key.
2. In Family mode, use **Invite** to add a member email.
3. Family events appear in the Family panel after Family-mode analyses.
4. `GET /family/events` returns recent metadata-only events for owner/active members.

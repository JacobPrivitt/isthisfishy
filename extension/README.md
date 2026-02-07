# IsThisFishy Browser Extension (Chrome/Edge MV3)

Minimal extension UI for IsThisFishy `/api/v1` endpoints.

## Files
- `manifest.json` - MV3 manifest
- `background.js` - context menu handler + selected text capture
- `popup.html` / `popup.js` / `popup.css` - popup UI
- `results.html` - tab view used by right-click flow
- `icons/` - placeholder icons

## Load Unpacked
1. Open Chrome or Edge.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder.

## Right-Click Flow
1. Highlight text on any webpage.
2. Right-click and choose **Check with IsThisFishy**.
3. Extension stores selected text in transient storage and opens `results.html`.
4. The analysis auto-runs once when that page opens.

## Dev Auth Toggle
- **Signed in (dev)** toggle controls whether requests include `Authorization: Bearer dev`.
- `private` can run anonymously.
- `shared` and `family` will include auth header automatically.
- Redeem (`/api/v1/redeem`) requires Signed in (dev) ON.

## Notes
- Message text is not logged by the extension.
- If API returns v1 error shape, popup uses `error.code` and `error.message`.
- Legacy error shapes are also handled safely.
- API base URL defaults to `http://127.0.0.1:8000`.

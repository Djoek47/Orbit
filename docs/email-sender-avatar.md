# Email sender avatar (inbox profile picture)

Resend cannot inject a custom “from” avatar via API. Inbox logos are controlled by mailbox providers. Use the official square house mark we ship:

**Asset:** `assets/brand/choremaxx-email-avatar.png` (512×512, cream plate + coral house)  
**Public URL (after push):**  
`https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-avatar.png`

Also mirrored for site deploy: `site/public/emails/sender-avatar.png`.

## Fast path (recommended now)

1. **Gravatar** — create/login at [gravatar.com](https://gravatar.com), upload `choremaxx-email-avatar.png`, verify `noreply@choremaxx.app` (or your From address). Many clients (Thunderbird, etc.) show this.
2. **Apple Branded Mail** — [Apple Business Connect](https://www.apple.com/business/connect/) → verify Choremaxx → upload the same PNG. Shows in Apple Mail / iOS.
3. **Gmail / Workspace** — if you ever send from a Google Workspace mailbox on the domain, set that account’s profile photo to the same mark (only helps Gmail↔Gmail).

## Longer path (BIMI)

For a logo next to every message in supporting inboxes:

1. DMARC on `choremaxx.app` at `p=quarantine` or `p=reject`
2. Common/Verified Mark Certificate + SVG Tiny PS logo
3. BIMI DNS TXT — see [Resend BIMI docs](https://resend.com/docs/dashboard/domains/bimi)

Do this after Auth emails are live; it does not block A2 smoke.

## In-email logo (already wired)

Auth HTML uses the house mark at `assets/brand/choremaxx-email-logo-mark.png` (not the old checkmark/app-icon tile). Redeploy `send-auth-email` after changes.

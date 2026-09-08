# Website agent brief — Email confirmation bridge (ship now)

**Audience:** Agent working on `Djoek47/Choremaxx-Website`  
**Live host:** `https://www.choremaxx.app` (also serve apex `https://choremaxx.app`)  
**Companion app:** `Djoek47/Orbit` · tip `cursor/choremaxx-make-v11` · TestFlight **1.1.0**  
**App Store ID:** `6796850110` · Bundle: `app.choremaxx.household` · Team: `R98S6HMKZL`

Paste this whole file into the website agent. Do **not** invent product features beyond this brief.

---

## Why this exists

Choremaxx Auth emails (Resend / Supabase Send Email Hook) no longer use a primary CTA of `choremaxx://…`.

**Mail clients often render custom-scheme URLs as plain text**, so users cannot tap “Confirm email.”

Emails now point at an **HTTPS** URL on the marketing site. The site must **bridge** into the app with the auth params intact. Verification (`verifyOtp`) happens **only inside the iOS app** — never on the website.

---

## End-to-end flow (source of truth)

```
User signs up in Choremaxx (TestFlight / Get Started)
        │
        ▼
Supabase Auth + send-auth-email (Resend)
  Email CTA → https://www.choremaxx.app/auth/callback?token_hash=…&type=signup
  Email also shows a numeric OTP for in-app entry
        │
        ▼
Website /auth/callback  ← YOU OWN THIS
  Calm “Opening Choremaxx…” page
  Forward → choremaxx://auth/callback?token_hash=…&type=signup
  (Universal Link if AASA installed; else custom scheme)
        │
        ▼
App app/auth/callback.tsx
  verifyOtp / session from token_hash
  Success → premium onboarding gate
  Failure / timeout → Confirm email screen (enter OTP)
```

**Fallback (no website / link fails):** user stays in app → **Confirm your email** → types the code from the email → `verifyOtp({ type: 'signup' })`.

---

## Must ship on the website

### 1. Page: `/auth/callback` (critical — no 404)

**Suggested file:** `app/auth/callback/page.tsx` (Next.js App Router)

#### Behavior checklist

| # | Requirement |
|---|-------------|
| 1 | `robots: noindex` (metadata) |
| 2 | Read from **query string**: `token_hash` (or `token`), `type`, optional `code`, `access_token`, `refresh_token`, `error`, `error_description` |
| 3 | Client effect: also parse `location.hash` if Supabase ever lands with fragments; **copy those params into the query string** before forwarding |
| 4 | Build deep link: `choremaxx://auth/callback?<same params as query>` — **never hash-only** into the app |
| 5 | Auto-attempt open after **400–800ms** |
| 6 | Always show a visible primary button **Open Choremaxx** (same deep link) — never a forever spinner with no exit |
| 7 | Secondary: App Store → `https://apps.apple.com/app/id6796850110` |
| 8 | Tertiary help line: “Or open Choremaxx → Confirm your email → enter the code from this email.” |
| 9 | If `error` / `error_description` present: show calm error + App Store + help line (do not open a broken deep link) |

#### Example deep-link builder (TypeScript)

```ts
function buildAppConfirmUrl(search: URLSearchParams, hashParams?: URLSearchParams): string {
  const merged = new URLSearchParams(search);
  hashParams?.forEach((v, k) => {
    if (!merged.has(k)) merged.set(k, v);
  });
  // Normalize aliases
  if (!merged.get('token_hash') && merged.get('token')) {
    merged.set('token_hash', merged.get('token')!);
  }
  if (!merged.get('type')) merged.set('type', 'signup');
  return `choremaxx://auth/callback?${merged.toString()}`;
}
```

#### UI (Apple-caliber)

- Soft wash background (cream / charcoal — **not** flat SaaS purple)
- Choremaxx wordmark / house mark as hero brand signal
- Large title: **Opening Choremaxx…**
- One short line: “Confirming your email”
- Primary CTA: **Open Choremaxx**
- Secondary: **Get the app** (App Store)
- No cards in the hero, no promo clutter, no stats strip

### 2. Universal Links — Apple App Site Association

**File:** `public/.well-known/apple-app-site-association` (no file extension)  
**Header:** `Content-Type: application/json`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["R98S6HMKZL.app.choremaxx.household"],
        "paths": [
          "/auth/callback",
          "/auth/callback/*",
          "/join/*"
        ]
      }
    ]
  }
}
```

Ship the same paths for **both** `www.choremaxx.app` and apex `choremaxx.app` (or redirect apex → www **without** stripping query params on `/auth/callback`).

Ensure `next.config` does **not** rewrite or block `/.well-known/*`.

### 3. Android (if Play listing exists)

`public/.well-known/assetlinks.json` with package `app.choremaxx.household` and path `/auth/callback` — skip if Play is not live yet.

### 4. Invite bridge (same pass if not already live)

`/join/[code]` → open `choremaxx://join/{CODE}` + App Store fallback. Keep AASA path `/join/*`.

### 5. Email brand assets (needed by Resend HTML)

Serve **200**:

- `https://www.choremaxx.app/emails/logo-mark.png`
- `https://www.choremaxx.app/emails/sender-avatar.png`

Copy from Orbit: `assets/brand/choremaxx-email-logo-mark.png` and `choremaxx-email-avatar.png`.

---

## What the website must NOT do

- Do **not** call Supabase `verifyOtp`, exchange codes, or store sessions on the site
- Do **not** put `OPENAI_API_KEY`, service role, or Auth secrets in the website
- Do **not** forward with **hash-only** params (`choremaxx://auth/callback#access_token=…`) — iOS often drops them
- Do **not** leave `/auth/callback` as a marketing 404 or homepage redirect that drops query params
- Do **not** re-theme the whole marketing site in this task — ship the bridge first

---

## Ops note (Supabase — human / app ops, not website code)

Auth → URL configuration allow-list must include:

- `https://www.choremaxx.app/auth/callback`
- `https://choremaxx.app/auth/callback`
- `choremaxx://auth/callback`

App + edge already set email CTA to the HTTPS bridge (`EMAIL_CONFIRM_WEB_URL`).

---

## Smoke tests (required before calling done)

```bash
# Bridge page exists
curl -sI "https://www.choremaxx.app/auth/callback?token_hash=test&type=signup" | head -5
# expect HTTP 200 (not 404)

# AASA live
curl -sI "https://www.choremaxx.app/.well-known/apple-app-site-association" | head -10
# expect 200 + application/json

# Query preserved (no strip)
curl -sL -o /dev/null -w "%{url_effective}\n" \
  "https://www.choremaxx.app/auth/callback?token_hash=abc123&type=signup"
# effective URL must still contain token_hash=abc123
```

### Manual (TestFlight)

1. Sign up with a real email → inbox receives **Confirm email** (HTTPS) + **code**
2. Tap **Confirm email** in Mail → Safari/site opens → forwards into Choremaxx
3. App shows brief “Confirming…” then success / onboarding — **never** endless spinner
4. Kill the bridge: open app → Confirm your email → enter the **code** → still works
5. Invite (if shipped): open `https://www.choremaxx.app/join/DEMOCODE` → app or App Store

---

## Acceptance criteria

- [ ] `/auth/callback` returns 200 with query params preserved  
- [ ] Page auto-opens `choremaxx://auth/callback?…` and keeps **Open Choremaxx** visible  
- [ ] AASA live for `/auth/callback` and `/join/*`  
- [ ] Email logo / avatar URLs return 200  
- [ ] TestFlight: Mail CTA → site → app confirms  
- [ ] TestFlight: OTP path still works without the website  

---

## Pasteable agent prompt (short)

```
Ship the Choremaxx email-confirmation website bridge on Choremaxx-Website.

Emails now CTA to:
  https://www.choremaxx.app/auth/callback?token_hash=…&type=signup

Implement app/auth/callback/page.tsx that:
1. noindex
2. Reads token_hash, type (+ code/tokens/error) from query; also migrates hash→query
3. Forwards to choremaxx://auth/callback?<same query> — never hash-only
4. Auto-open in 400–800ms + always-visible “Open Choremaxx” button
5. App Store fallback https://apps.apple.com/app/id6796850110
6. Calm Apple UI: soft wash, wordmark, “Opening Choremaxx…”, no forever spinner
7. Do NOT verifyOtp or touch Supabase secrets on the site

Also ship public/.well-known/apple-app-site-association with
appIDs R98S6HMKZL.app.choremaxx.household and paths /auth/callback, /auth/callback/*, /join/*.

Smoke: curl 200 on /auth/callback and AASA; TestFlight Mail link opens app.

Full brief: docs/website-agent-email-confirmation.md in Orbit (cursor/choremaxx-make-v11).
```

---

## Related Orbit docs

| Doc | Role |
|-----|------|
| This file | **Paste to website agent** |
| `docs/website-agent-auth-bridge-now.md` | Short bridge checklist |
| `docs/website-agent-handoff.md` | Full site A1/B4 + brand kit |
| `docs/resend-auth-email.md` | How Auth emails are sent (app/ops) |
| App: `app/auth/callback.tsx`, `app/confirm-email.tsx` | In-app verify + OTP |
| Edge: `supabase/functions/send-auth-email` | Builds HTTPS CTA + OTP in email |

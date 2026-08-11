# Website agent — auth email bridge (do now)

The Orbit app + Resend Auth emails now point confirmation CTAs at:

`https://www.choremaxx.app/auth/callback?token_hash=…&type=signup`

Custom-scheme-only links (`choremaxx://…`) are no longer the primary email CTA — Mail often shows them as plain text.

**Your job is the website half.** Ship this so confirm links are clickable and open the app with the token intact.

## Must ship

### 1. `/auth/callback` page (critical)

File: `app/auth/callback/page.tsx` (Next.js App Router)

Behavior:

1. `robots: noindex`
2. Read `token_hash`, `type`, optional `code` / `access_token` / `refresh_token` / `error` from **query**
3. Also read `location.hash` if Supabase still redirects with fragments (client effect)
4. Forward to **`choremaxx://auth/callback?…`** with the **same params in the query string** (never only in the hash)
5. Calm Apple-simple UI:
   - Soft wash background (not flat SaaS purple)
   - choremaxx wordmark
   - Large title: **Opening Choremaxx…**
   - One short line: “Confirming your email”
   - Primary button: **Open Choremaxx** (same deep link)
   - Fallback: App Store `https://apps.apple.com/app/id6796850110`
6. Auto-attempt open after a short delay (~400–800ms)
7. Never show a forever spinner with no exit — always keep the Open button visible

### 2. Universal Links / AASA

`public/.well-known/apple-app-site-association` (no extension), `Content-Type: application/json`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["R98S6HMKZL.app.choremaxx.household"],
        "paths": ["/auth/callback", "/auth/callback/*", "/join/*"]
      }
    ]
  }
}
```

Also ship `public/.well-known/assetlinks.json` for Android if Play is live.

Ensure `next.config` does not rewrite/block `/.well-known/*`.

### 3. Invite bridge (same pass if not live)

`/join/[code]` → `choremaxx://join/{CODE}` + App Store fallback. Spec in `docs/website-agent-handoff.md` §4.3.

### 4. Allow-list note for Supabase (ops, not code)

Ask whoever owns Supabase Auth → URL configuration to allow:

- `https://www.choremaxx.app/auth/callback`
- `https://choremaxx.app/auth/callback`
- `choremaxx://auth/callback` (still used after the bridge)

## Smoke tests

```bash
curl -I "https://www.choremaxx.app/auth/callback?token_hash=test&type=signup"
# expect 200, not 404

curl -I "https://www.choremaxx.app/.well-known/apple-app-site-association"
# expect 200 + application/json
```

Manual:

1. Sign up in TestFlight → open Confirm email button in Mail  
2. Browser/site opens → forwards into app  
3. App shows brief Confirming → **You're in** (or Enter code) — **never** endless spinner  
4. If link fails, enter the email code on Confirm your email in-app

## Visual direction

Apple-caliber restraint: soft whites / deep charcoals, sparse coral accent, large type, generous space. No cards in the hero, no promo clutter. Brand wordmark is the hero signal.

## Do not

- Put auth secrets or `verifyOtp` on the website — only forward params into the app
- Use hash-only redirects into `choremaxx://`
- Leave `/auth/callback` as a marketing 404

Full prior handoff: `docs/website-agent-handoff.md` (Orbit).

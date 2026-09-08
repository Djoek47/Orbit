# Resend for Supabase Auth emails

Supabase Auth still owns **login, signup, sessions, and confirmation tokens**.  
**Resend** delivers the emails so you escape the built-in Auth mailer (~2 messages/hour) and the “email address not authorized” team-only restriction.

App client code does not change: `signUp`, `resend`, and password reset already call Supabase Auth.

Pick **one** delivery path:

| Path | When to use | Effort |
|------|-------------|--------|
| **A — Custom SMTP** | Fastest production fix; keep Supabase Auth email templates | Dashboard only |
| **B — Send Email Hook** | Branded HTML via Resend API (`send-auth-email` edge function) | Deploy function + Auth Hook |

Do **not** enable Path B while relying on Path A for the same Auth emails — the Send Email Hook replaces Supabase’s mailer for those events.

**Branded HTML for Path B:** Edge function uses
`supabase/functions/send-auth-email/branded-html.ts` (must stay inside the
function folder so deploy bundles it). Latest visual: coral brand band,
`class="cm-cell"` hairline, chip eyebrow, gradient CTA, white OTP tile.
Postal line is `Choremaxx · privacy@choremaxx.app` (not a fake street).
Preview: `docs/email/confirm-email.html` (written by `npm run test:auth-emails`).
**Redeploy the function** or the live inbox stays on the old markup.

---

## Prerequisites

1. [Resend](https://resend.com) account
2. [API key](https://resend.com/api-keys) (`re_…`)
3. [Verified domain](https://resend.com/domains) (e.g. `choremaxx.app`) with SPF / DKIM / DMARC as Resend instructs
4. Sender address on that domain, e.g. `noreply@choremaxx.app` or `auth@choremaxx.app`

Until the domain is verified, Resend only delivers to your own Resend account email (good for a smoke test).

---

## Path A — Custom SMTP (recommended first)

### 1. Enable SMTP in Supabase

Dashboard → **Authentication** → **Email** (Notifications) → **SMTP Settings** (or [Auth SMTP](https://supabase.com/dashboard/project/_/auth/smtp)):

| Field | Value |
|-------|--------|
| Enable custom SMTP | On |
| Sender email | `noreply@choremaxx.app` (verified domain) |
| Sender name | `Choremaxx` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key (`re_…`) |

Official Resend guide: [Send emails using Supabase with SMTP](https://resend.com/docs/send-with-supabase-smtp).

### 2. Raise Auth email rate limits

After custom SMTP is saved, Supabase still starts with a conservative cap (~30/hour). Raise it for your launch volume:

Dashboard → **Authentication** → **Rate Limits**  
([rate-limits](https://supabase.com/dashboard/project/_/auth/rate-limits))

Suggested starting point for early TestFlight: **email sent** ≥ 100/hour (tune with Resend reputation + CAPTCHA later).

### 3. Optional: Management API

```bash
export SUPABASE_ACCESS_TOKEN="…"   # https://supabase.com/dashboard/account/tokens
export PROJECT_REF="…"

curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_email_enabled": true,
    "smtp_admin_email": "noreply@choremaxx.app",
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": "re_YOUR_KEY",
    "smtp_sender_name": "Choremaxx"
  }'
```

### 4. Verify

1. Sign up a non-team email from the app (TestFlight or staging).
2. Confirm delivery in [Resend → Emails](https://resend.com/emails).
3. Open the link → `https://www.choremaxx.app/auth/callback?token_hash=…&type=signup` (website bridge) → app `choremaxx://auth/callback?…` → `verifyOtp` in-app.  
   Or enter the email code on Confirm your email.

---

## Path B — Send Email Hook (branded templates)

Use when you want Choremaxx HTML (subject/body) instead of Supabase’s default templates. Delivery still goes through Resend’s API.

### 1. Deploy the edge function

```bash
npx supabase link --project-ref YOUR_REF

# JWT verification must be off — Auth Hooks use webhook signatures, not user JWTs
npx supabase functions deploy send-auth-email --no-verify-jwt

npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set RESEND_FROM_EMAIL="Choremaxx <noreply@choremaxx.app>"
# Paste the full secret from the dashboard after generating the hook (includes v1,whsec_ prefix)
npx supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."
```

`SUPABASE_URL` is injected automatically and used to build `/auth/v1/verify` links.

### 2. Enable the Auth Hook

Dashboard → **Authentication** → **Hooks** → **Send Email**:

1. Type: **HTTPS**
2. URL: `https://YOUR_REF.supabase.co/functions/v1/send-auth-email`
3. **Generate secret** → copy into `SEND_EMAIL_HOOK_SECRET` (re-set secret if you generated after first deploy)
4. Save / enable

### 3. Confirm Path A is not required

With the hook enabled, Auth does not use the built-in/SMTP mailer for those emails. You can leave SMTP off, or keep SMTP only as a future fallback after disabling the hook.

### 4. Verify

Same as Path A — signup / resend / forgot-password should appear in Resend with Choremaxx subjects from `send-auth-email`.

If signup returns `unexpected_failure` with **hook 502**, the hook is on and running, but **Resend rejected the send**. Typical causes:

1. `choremaxx.app` is not verified in [Resend → Domains](https://resend.com/domains) (SPF/DKIM pending)
2. `RESEND_FROM_EMAIL` is not on that verified domain (default `Choremaxx <noreply@choremaxx.app>`)
3. `RESEND_API_KEY` is missing, test-only, or rotated
4. Resend is in test mode — it only delivers to the Resend account email

Until that 502 is gone, email/password signup cannot create an account. Apple Sign-In is unaffected.

---

## What stays in Supabase

- Email + password (and Apple) providers
- Confirm email on/off, redirect allow-list (`https://www.choremaxx.app/auth/callback`, `choremaxx://auth/callback`)
- Auth templates **if** you stay on Path A (Dashboard → Authentication → Email Templates)
- Rate-limit knobs (raise after custom SMTP or when hook + Resend is live)

## Secrets (never in the Expo client)

| Secret | Where | Path |
|--------|--------|------|
| Resend API key | Supabase SMTP password **or** Edge Function secret `RESEND_API_KEY` | A / B |
| `SEND_EMAIL_HOOK_SECRET` | Edge Function secrets | B |
| `RESEND_FROM_EMAIL` | Edge Function secrets (optional; default `Choremaxx <noreply@choremaxx.app>`) | B |

Do not put `RESEND_API_KEY` in `.env` / EAS public env for the mobile app.

## Ops tips

- Prefer a dedicated auth from-address (`noreply@` / `auth@`) separate from marketing.
- Keep confirmation copy short; avoid promo CTAs (deliverability).
- If bots hammer signup, add [Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) — don’t disable email confirmation under pressure.
- Client still has a 60s resend cooldown (`lib/auth/email-confirmation.ts`) so the UI doesn’t spam Auth.

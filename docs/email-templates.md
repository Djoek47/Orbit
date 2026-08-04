# ChoreMaxx transactional email templates

15 React Email templates for ChoreMaxx, in `emails/`. Built with
`@react-email/components`, previewable locally, and smoke-tested — see
[emails/preview/README.md](../emails/preview/README.md).

**Scope of this drop:** templates + component library only. Per-template
wiring into a live send (Supabase Auth Hook, a new edge function, a
billing webhook, etc.) happens incrementally afterward, one at a time.

## Brand

Fixed coral/cream ChoreMaxx identity for every email, independent of a
household's in-app accent theme (Sky/Citrus/Coral/Berry) — the logo lockup
never changes color. Tokens live in [`emails/theme.ts`](../emails/theme.ts):

| Token | Hex | Note |
|-------|-----|------|
| `coral` | `#D85A30` | Primary — "maxx", buttons, app icon (matches `constants/choremaxx-brand.ts`) |
| `accent` | `#E4552B` | Secondary CTAs / links — email-only, not in the in-app theme |
| `darkText` | `#712B13` | "chore" wordmark, headlines (matches brand constants) |
| `cream` | `#FAC775` | Highlight fills (matches brand constants) |
| `bg` | `#F7F4F2` | Page background outside the card — email-only |

600px max width, white card, 24px card radius, 16px button radius, 48px
outer / 32px inner spacing, system font stack only (no external fonts, no
emojis, no inline SVG icons other than the logo).

**Logo hosting (action needed before any live send):** email clients can't
load bundled Expo assets. `EMAIL_LOGO_URL` in `emails/theme.ts` currently
points at a placeholder (`https://choremaxx.app/emails/logo-mark.png`).
Upload `assets/brand/choremaxx-logo-mark.png` to a public Supabase Storage
bucket (or the marketing site) and update that constant before the first
real send. The wordmark itself is rendered as colored HTML text (not baked
into the image), so it stays crisp even with images blocked.

## Component library

| Component | Used for |
|-----------|----------|
| `EmailLayout` | Html/Head/Body/Container shell every template wraps in |
| `EmailHeader` | Centered logo + "chore"/"maxx" wordmark + tagline |
| `EmailFooter` | Support / website / manage account / privacy / terms / copyright |
| `PrimaryButton` | Coral filled CTA, 52px, 16px radius |
| `SecondaryButton` | Outline CTA (Download Invoice, Reactivate) |
| `InfoCard` | Muted key/value rows (invite details, task metadata, device info) |
| `StatCard` | 2-up stat grid (weekly summary, XP/streak) |
| `AlertBox` | Text-labeled callout (info/warning/danger/success) — never an icon |
| `InvoiceTable` | Line items + total (receipts) |
| `Divider` | Hairline rule |

## Catalog

| # | Template | File | Subject | Trigger status |
|---|----------|------|---------|-----------------|
| 1 | Email Verification | `emails/verification.tsx` | Verify your ChoreMaxx account | **Wired** — Supabase Auth Send Email Hook, action `signup` |
| 2 | Welcome | `emails/welcome.tsx` | Welcome to ChoreMaxx | TODO — no post-confirmation trigger exists |
| 3 | Password Reset | `emails/password-reset.tsx` | Reset your password | **Wired** — Auth Hook, action `recovery` |
| 4 | Magic Login Link | `emails/magic-link.tsx` | Your ChoreMaxx sign-in link | **Wired** — Auth Hook, action `magiclink`/`email` |
| 5 | Household Invitation | `emails/household-invite.tsx` | You've been invited to join {household} | TODO — invites are code/deep-link only today |
| 6 | Task Assigned | `emails/task-assigned.tsx` | New task: {title} | TODO — task creation is in-app only |
| 7 | Task Completed | `emails/task-completed.tsx` | Task complete: {title} | TODO — completion is in-app/push only |
| 8 | Weekly Household Summary | `emails/weekly-summary.tsx` | Your weekly summary — {household} | TODO — digest exists in-app (`poppins-briefing`), no email dispatch |
| 9 | Subscription Started | `emails/subscription-started.tsx` | Your {plan} subscription is active | TODO — **no billing/Stripe feature exists** |
| 10 | Payment Receipt | `emails/payment-receipt.tsx` | Receipt for invoice {number} | TODO — no billing feature exists |
| 11 | Payment Failed | `emails/payment-failed.tsx` | We couldn't process your ChoreMaxx payment | TODO — no billing feature exists |
| 12 | Subscription Cancelled | `emails/subscription-cancelled.tsx` | Your {plan} subscription is cancelled | TODO — no billing feature exists |
| 13 | Trial Ending | `emails/trial-ending.tsx` | Your trial ends in {n} days | TODO — no trial concept exists |
| 14 | Security Alert | `emails/security-alert.tsx` | New sign-in to your ChoreMaxx account | TODO — no login-anomaly detection exists |
| 15 | Email Changed | `emails/email-changed.tsx` | Your ChoreMaxx email address changed | **Wired** — Auth Hook, action `email_change` |

Every template file has a header comment repeating its trigger status and,
for the TODOs, the concrete next step to unlock it.

## Preview locally

```bash
npm run email:dev      # http://localhost:3010 — live, hot-reloading preview
npm run test:emails    # smoke-render all 15 with mock props
```

## Wiring roadmap (do these one at a time, not all at once)

**Now possible — swap `send-auth-email`'s inline HTML for these templates:**

`supabase/functions/send-auth-email/index.ts` currently builds HTML by hand
(`renderEmail`/`subjectFor`/`bodyFor`). Replacing that with the new
templates is a like-for-like swap once the Deno import path is settled:

1. Add a Deno import map (e.g. `supabase/functions/deno.json`) mapping bare
   specifiers (`react`, `@react-email/components`, `@react-email/render`)
   to `npm:` equivalents — same pattern Resend's official Supabase example
   uses.
2. Import `../../../emails/verification.tsx` (etc.) and `../../../emails/render.ts`
   from `send-auth-email/index.ts`.
3. Map each `email_action_type` (`signup` → verification, `recovery` →
   password-reset, `magiclink`/`email` → magic-link, `email_change` →
   email-changed) to its template + `render()` call.
4. Redeploy: `npx supabase functions deploy send-auth-email --no-verify-jwt`.
5. Test per [resend-auth-email.md](./resend-auth-email.md) — sign up a
   non-team address and confirm the new design arrives via Resend.

**Needs new app-side work before it can be wired:**

- **Welcome** — add a Database Webhook on `auth.users` (fires when
  `confirmed_at` goes from null → timestamp) that calls a new
  `send-welcome-email` function, or trigger client-side right after
  `hydrateFromSession` succeeds post-confirmation.
- **Household Invitation** — needs an email-based invite flow (today invites
  are code/deep-link only, `supabase/functions/join-household`). Add an
  "invite by email" input in the admin UI that calls a new
  `send-household-invite` function.
- **Task Assigned / Task Completed** — parallel the existing in-app
  `notifications` writers (`poppinsNotifications.taskCompleted`, task
  reassignment) with an email send once members can opt in to email
  notifications.
- **Weekly Household Summary** — reuse the `poppins-briefing` weekly
  payload; add a cron/edge function that also sends the email version.
- **Security Alert** — needs new device/location anomaly detection on
  sign-in (none exists today).
- **Subscription Started / Payment Receipt / Payment Failed / Subscription
  Cancelled / Trial Ending** — **blocked on adding a billing provider**
  (e.g. Stripe) to ChoreMaxx first; there is nothing in the app to trigger
  these from yet. Build billing, then wire from the provider's webhooks.

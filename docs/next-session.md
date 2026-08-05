# Next session — finish website, Resend emails, close MVP

**Status:** Revision D STOP GATES passed on `cursor/choremaxx-make-v9-5f8f` — these three are the remaining finish list.  
**Domain:** `https://mytikas73.com`  
**Shipping branch:** `cursor/choremaxx-make-v9-5f8f` → PR #28  

See `docs/logic/V9_BRANCH.md` and `docs/logic/choremaxx-revision-d-spec.md`.

Do these in order:

---

## 1. Finish the marketing / legal website

- [ ] Pull V0 output into a deployable Next.js app (own repo or `web/` if we keep it here)
- [ ] Deploy to Vercel with custom domain **mytikas73.com** (apex + www → apex)
- [ ] Confirm public pages load without login:
  - [ ] `https://mytikas73.com/`
  - [ ] `https://mytikas73.com/privacy`
  - [ ] `https://mytikas73.com/terms`
  - [ ] `https://mytikas73.com/support`
  - [ ] `https://mytikas73.com/copyright`
  - [ ] `https://mytikas73.com/sitemap.xml`
  - [ ] `https://mytikas73.com/robots.txt`
- [ ] Host brand mark for emails: `https://mytikas73.com/emails/logo-mark.png`
- [ ] SEO pass: unique titles/descriptions, OG image, Organization + SoftwareApplication JSON-LD, Search Console sitemap submit
- [ ] Point App Store Connect + Play Console Privacy Policy URL → `https://mytikas73.com/privacy`
- [ ] Update EAS / app env:
  - `EXPO_PUBLIC_PRIVACY_URL=https://mytikas73.com/privacy`
  - `EXPO_PUBLIC_TERMS_URL=https://mytikas73.com/terms`
- [ ] Update in-repo defaults that still say `choremaxx.app` for website URLs (`.env.example`, `constants/choremaxx-brand.ts`, `emails/theme.ts` `EMAIL_LOGO_URL` / `EMAIL_LINKS`, docs) where the public site host matters

**V0 brief:** use the SEO + `mytikas73.com` prompt from the prior chat. Product/legal source: `docs/product-context.md`, `docs/legal/*`.

---

## 2. Connect new React Email templates → Resend / Supabase

Templates already built in `emails/` (15/15 smoke-tested). Docs: `docs/email-templates.md`, `docs/resend-auth-email.md`.

### Wire first (Auth — real triggers exist)

- [ ] Host logo URL in `emails/theme.ts` → `https://mytikas73.com/emails/logo-mark.png`
- [ ] Swap `supabase/functions/send-auth-email` inline HTML for:
  - [ ] `emails/verification.tsx` ← `signup`
  - [ ] `emails/password-reset.tsx` ← `recovery`
  - [ ] `emails/magic-link.tsx` ← `magiclink` / `email`
  - [ ] `emails/email-changed.tsx` ← `email_change`
- [ ] Ensure Resend path is live (Custom SMTP **or** Send Email Hook — not both fighting)
- [ ] Raise Supabase Auth email rate limits after custom SMTP
- [ ] Live test: signup → branded verify email arrives via Resend → deep link `choremaxx://auth/callback`

### Wire later (no trigger yet — one by one)

- [ ] Welcome
- [ ] Household invitation (needs email-invite flow)
- [ ] Task assigned / completed
- [ ] Weekly summary (reuse `poppins-briefing` payload)
- [ ] Security alert
- [ ] Billing emails — **blocked until a payment provider exists**

---

## 3. Close out MVP

Use this as the “MVP is over” gate. Product bar from `docs/product-context.md`:

- [ ] Account creation + sign-in (email + Apple where enabled)
- [ ] Household create / join (invite code / QR)
- [ ] Roles + child-safe flows
- [ ] Tasks assign / complete / XP (Meritocracy + Equity both correct)
- [ ] Plan (calendar) + Rewards basics
- [ ] Nova usable in shipping mode
- [ ] Public legal site live on **mytikas73.com** (Privacy + Terms + Support)
- [ ] Auth emails delivered via Resend with ChoreMaxx templates
- [ ] TestFlight / store listing URLs point at mytikas73.com legal pages
- [ ] Staging Supabase migrations current (incl. reward model / occurrence columns as needed)
- [ ] Smoke: signup → confirm email → create household → assign task → complete → rewards path

When the checklist above is green, call MVP closed and move to growth (richer Nova, grocery intelligence, push polish, etc.).

---

## Quick pointers

| Area | Where |
|------|--------|
| Email templates | `emails/` |
| Email wiring guide | `docs/email-templates.md` |
| Resend + Supabase Auth | `docs/resend-auth-email.md` |
| Legal source copy | `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md` |
| Shipping branch | `cursor/choremaxx-make-v9-5f8f` → PR #28 into Make v7 |
| TestFlight build 19 | in progress / auto-submit to ASC |

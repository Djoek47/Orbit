# Weekend ship — Phase A/B completion report

**Branch:** `cursor/choremaxx-make-v10-5f8f`  
**Date:** 2026-08-10  
**Playbook:** `docs/weekend-ship-automation.md`

## Phase A

| ID | Result | Notes |
|----|--------|-------|
| **A1** | ◐ PARTIAL → in-repo DONE | Legal Nova→Poppins + families-only (`docs/legal/*`). ASC listing draft in `docs/app-store-checklist.md`. EAS env set: `EXPO_PUBLIC_PRIVACY_URL` / `TERMS_URL` on production/preview/development. Brand constants read env with vercel.app fallbacks. **Blocked external:** marketing site still has roommate mode + Nova FAQ — apply `docs/site-copy-a1-patch.md` in Vercel repo; re-host privacy/terms HTML. |
| **A2** | ◐ CODE DONE | React Email wired into `send-auth-email` + `emails/auth-hook-render.ts` + tests. **Blocked live:** needs `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, Auth Hook enable, deploy `--no-verify-jwt`, then signup → `choremaxx://auth/callback`. Logo host: upload mark to `choremaxx.vercel.app/emails/logo-mark.png`. |
| **A3** | ◐ SCAFFOLD | `constants/billing.ts` + `lib/billing/iap.ts` (7-day trial, $4.99/mo, $48/yr, mock entitlement). **Blocked:** ASC subscription products + native `expo-iap`/StoreKit on device builds. |
| **A4** | ✅ PASS (unit) | Gate + Mark as paid ledger smoke (`lib/rewards/a4-smoke.test.ts`). Full staging mint→approve still needs TestFlight/supabase session. |
| **A5** | ◐ DONE foundation | Quiet hours pref + defer OS banners 21:00–07:00 in `pushNotification`; Settings toggle. Batching engine already tested. |
| **A6** | ◐ DEPLOYED — NEEDS KEY | Edge functions deployed on staging (`poppins-chat`, `briefing`, `voice`, `realtime-session`, `monitor`, `join-household`). TestFlight / EAS already set `EXPO_PUBLIC_POPPINS_AI=openai`. **Blocked live:** set `OPENAI_API_KEY` then `bash scripts/smoke-poppins-openai.sh` + device chat. |
| **A7** | ✅ PASS (unit) | Role matrix tests (`lib/account/a7-matrix.test.ts`). |
| **A8** | ◐ DRAFT | ASC listing fields filled in checklist. **Do not submit** until B6/B7. |

## Phase B

| ID | Result | Notes |
|----|--------|-------|
| **B1** | ◐ DONE | Poppins co-manager system prompt (client + `poppins-chat`). |
| **B2** | ◐ EXISTING | Itinerary suggest tools already in store; no new invention. |
| **B3** | ◐ DONE | Deep links hardened in `lib/notifications/navigate.ts` + action helper/tests. |
| **B4** | ☐ BLOCKED | Site outside repo — see `docs/site-copy-a1-patch.md`. |
| **B5** | ☐ BLOCKED | Needs A3 ASC products live. Billing email templates already exist. |
| **B6** | ◐ PARTIAL | `npm run test:weekend-a` + typecheck; full Expo Go + TestFlight manual matrix still human. |
| **B7** | ☐ BLOCKED | Wait for B6 green + A8 + live legal URLs on site. |

## Commands

```bash
npm run test:weekend-a
npm run typecheck
# Live A2 (human secrets):
npx supabase functions deploy send-auth-email --no-verify-jwt
```

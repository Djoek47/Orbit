# Weekend ship — Phase A/B completion report

**Branch:** `cursor/choremaxx-make-v10-5f8f`  
**Date:** 2026-08-10  
**Playbook:** `docs/weekend-ship-automation.md`

## Phase A

| ID | Result | Notes |
|----|--------|-------|
| **A1** | ◐ PARTIAL | In-repo legal + ASC draft + EAS privacy/terms. Site branding done locally under `/workspace/site` — **push blocked** (GitHub 403 on `Choremaxx-Website`). Live www may still be stale until you push/redeploy. |
| **A2** | ◐ CONNECTED | Resend secrets + `send-auth-email` ACTIVE. **Still:** enable Auth Send Email Hook in Supabase dashboard + signup smoke. |
| **A3** | ◐ IN APP | Catalog + Settings → Premium mock trial/restore. ASC product creation: `docs/asc-iap-setup.md`. StoreKit native path after products exist. |
| **A4** | ✅ PASS (unit) | Gate + Mark as paid ledger smoke. |
| **A5** | ✅ | Quiet hours + Settings toggle. |
| **A6** | ✅ EDGE | `OPENAI_API_KEY` set; Poppins functions ACTIVE; `smoke-poppins-openai.sh` PASS. Device chat smoke still human (TestFlight #27). |
| **A7** | ✅ PASS (unit) | Role permission tests. |
| **A8** | ◐ DRAFT | ASC listing draft — do not submit until B7. |

## Phase B

| ID | Result | Notes |
|----|--------|-------|
| **B1** | ✅ | Poppins co-manager prompt. |
| **B2** | ◐ EXISTING | Itinerary tools already in store. |
| **B3** | ✅ | Notification deep links. |
| **B4** | ☐ BLOCKED | Site CTAs — needs site push + A3 ASC. |
| **B5** | ☐ BLOCKED | Billing email templates exist; need A3 purchase events. |
| **B6** | ◐ PARTIAL | `npm run test:weekend-a`; device matrix human. |
| **B7** | ☐ LAST (before key rotations) | App Review after B6 + A8 + live legal URLs. |

## Final (after B7)

- [ ] Rotate Resend API key → update Supabase secret
- [ ] Rotate OpenAI API key → update Supabase secret
- [ ] Rotate `SEND_EMAIL_HOOK_SECRET` if exposed
- [ ] Confirm Auth Hook + Poppins still work after rotation

## Commands

```bash
npm run test:weekend-a
npm run typecheck
bash scripts/smoke-poppins-openai.sh
# A3 ASC: docs/asc-iap-setup.md
```

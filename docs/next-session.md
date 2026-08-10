# Next session — weekend App Store ship (in progress)

**Playbook:** [`docs/weekend-ship-automation.md`](./weekend-ship-automation.md)  
**Report:** [`WEEKEND_SHIP_COMPLETION_REPORT.md`](./WEEKEND_SHIP_COMPLETION_REPORT.md)  
**Branch:** `cursor/choremaxx-make-v10-5f8f` → [PR #29](https://github.com/Djoek47/Orbit/pull/29)

## Continue here (human secrets)

1. **A1 site** — apply [`site-copy-a1-patch.md`](./site-copy-a1-patch.md) on Vercel; re-host privacy/terms from `docs/legal/*`
2. **A2 live** — set Resend secrets, deploy `send-auth-email --no-verify-jwt`, enable Auth Hook, signup smoke → `choremaxx://auth/callback`
3. **A3 ASC** — create IAP products from `constants/billing.ts`, then wire StoreKit
4. **A6** — functions deployed; set `OPENAI_API_KEY` then `bash scripts/smoke-poppins-openai.sh` + live Poppins chat
5. **B4–B7** — site CTAs, billing emails, full device retest, App Review

## Do not redo

- Final Revision F core gates · House Rules · Canada grocery · Smart Shopping
- In-repo A1 legal/EAS URL refresh · A2 template wiring · A3–A5/A7 scaffolds already landed

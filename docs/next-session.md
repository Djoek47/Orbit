# Next session — weekend App Store ship

**Superseded for the big push by:** [`docs/weekend-ship-automation.md`](./weekend-ship-automation.md)

**Branch:** `cursor/choremaxx-make-v9-5f8f` → [PR #28](https://github.com/Djoek47/Orbit/pull/28)  
**Tip baseline after Aug 6 night:** Rev D + Rev E + House Rules Part 2 + monthly Rescue token + OTA on `testflight` / `august-6`.

## Tomorrow — start here

1. Paste the **Automation prompt** from `docs/weekend-ship-automation.md` into a Cursor Automation, **or** Agent: *Execute Phase A then Phase B from docs/weekend-ship-automation.md*.
2. Phase order is locked: **A (foundation) → B (craft)**. Do not skip to App Review.
3. Native iOS build may be blocked on EAS Free plan monthly quota — upgrade at https://expo.dev/accounts/djoek47/settings/billing then `npm run build:ios:testflight`. Until then, TestFlight **build 19** still receives OTA on channel `testflight`.

## Older 3-item list (folded into Phase A)

Website URLs + Resend auth templates + MVP close are now **A1, A2, and A7/B6** in the weekend playbook. Prefer the playbook so work is not duplicated.

**Live marketing site today:** https://choremaxx.vercel.app/  
**Custom domain notes (if still desired):** `mytikas73.com` — see prior checklist in git history of this file if needed.

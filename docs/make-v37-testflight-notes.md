# make-v37 TestFlight — release notes (build 124)

**Branch tip:** `cursor/make-v37-c30d`  
**Base:** make-v36 / TF **1.3.0 (121)**; TF **123** had v36-01 only  
**Patches:** `choremaxx-v36-all` (= v36-01 + v37-01) · `v37-01-console-diagnostics-sandbox` · `sandbox-testing.md`  
**Status:** Multipass re-audit clean; cutting **1.3.0 (124)** with Purchase diagnostics + support console.

---

## What’s in this build (on top of 121)

### Subscription UX
- Four paywall modes: free trial · trial ended · renew · subscribe
- Settings → Subscription dashboard (plan, status, days left, manage/cancel via Apple)
- Trial reminders (day-before; end if renewal off)
- Sign-out from gate / locked screen → Get Started (`signOutAndLeave`)
- Trial countdown uses real end date (no +16 day household grace on trials)

### Poppins / credits
- Trial Poppins: living orb, sells subscription (300/mo); packs stay in Credits
- Paid + out of actions: glass top-up sheet (200/700/2000); orb refills after buy
- Credits: every pack stays tappable; unlisted ASC SKUs fail at purchase with plain copy (no “Soon” grey-out)
- Credit history: packs, monthly allowance, this month’s use

### Lock Screen Live Activity — removed
- Grocery/trip Lock Screen banner, native bridge, widget Swift, `expo-live-activity` dep — gone
- Source archived outside the repo (`archive-lock-screen-live-activity.tgz`) for a later rebuild
- In-app trips/shopping still work

### Paused Sidekick / shared tablet
- Names admin who can renew; Account sheet (help, legal, switch, sign out); no purchase CTA

### v37-01 — console / diagnostics / sandbox (on tip)
- Support console backend: migration + `support-inbound` / `support-reply`; app feedback also files tickets; error reports (no stacks)
- **Purchase diagnostics** screen (admin/owner): StoreKit products, phone plan, household row, access decision, credits
- `docs/sandbox-testing.md` — 16-row sandbox matrix; `development-device` EAS profile to unlock Developer Mode without a Mac

---

## Matrix pass (re-audit before 124)

| Check | Result |
|-------|--------|
| Uploaded `v37-01` new files byte-match tip (`billing-diagnostics`, support-inbound/reply, migration) | OK |
| Uploaded `sandbox-testing.md` identical to `docs/sandbox-testing.md` | OK |
| `choremaxx-v36-all` = v36-01 (already on tip) + v37-01 (on tip); Live Activity deletes intentional | OK |
| `tsc --noEmit` | OK |
| subscription-status, payment-gate, household-entitlement, access-gate, pack-parity, premium-ui, iap, token-grants, shopping-run-ui, shared-device-one-flow, friendly-error, topup-receipt, credit-ledger, allowance-state | PASS |
| lint | 0 errors (pre-existing warnings only) |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged — same as 121/123) |
| Staging: support migration + functions | **Still blocked** until `SUPABASE_ACCESS_TOKEN` refreshed |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (124)** — make-v37 + v37-01 (123 = v36-01 only; 122 burned) |
| Branch | `cursor/make-v37-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/125 |
| Build | *(filling after cut)* |
| Submit | *(filling after cut)* |
| Prior (123) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/3aff88a9-4f1a-495e-ab8b-6e025588c3aa |
| Prior (121) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/9d650e20-249f-4214-ae59-67b73434b9b2 |

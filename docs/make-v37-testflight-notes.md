# make-v37 TestFlight — release notes (build 125)

**Branch tip:** `cursor/make-v37-c30d`  
**Base:** make-v36 / TF **1.3.0 (121)**; TF **123** had v36-01 only  
**Patches:** `choremaxx-v36-all` (= v36-01 + v37-01) · `v37-01-console-diagnostics-sandbox` · `sandbox-testing.md`  
**Status:** Cutting **1.3.0 (125)** — v37-03 (plan picker, hide diagnostics in App Store, household emails, support attachments).

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


### v37-03 — build 125 (on tip)
- My Subscription: animated Monthly/Yearly picker under the trial timer
- Purchase diagnostics hidden on App Store installs (TestFlight/dev only)
- `send-household-email`: Sidekick added, shared device created, trial ending (deduped)
- Support: inbound dedupe; feedback stores screenshots in private `support-attachments` bucket
- SQL to run in order: `20261008140000_household_email_log.sql` → `20261008150000_support_attachments.sql`
- Deploy: `send-household-email` `support-inbound` `send-support-feedback` (console zip deferred)

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
| Version | **1.3.0 (125)** — v37-03 plan picker / emails / attachments |
| Branch | `cursor/make-v37-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/125 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/23e0cb50-dbf5-4c1e-8b35-b5ce48550a11 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/8cf4bae7-76c5-4b1d-80b8-7bd4a8d50400 |
| Prior (124) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/73613804-113e-46fa-9b12-d2169ec56058 |
| Prior (123) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/3aff88a9-4f1a-495e-ab8b-6e025588c3aa |


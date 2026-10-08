# make-v37 TestFlight — release notes (build 122)

**Branch tip:** `cursor/make-v37-c30d`  
**Base:** make-v36 / TF **1.3.0 (121)**  
**Patch:** `v36-01-subscription-credits-poppins` (7 commits)  
**Status:** Live Activity Lock Screen removed (archived outside repo); subscription/Poppins fold.

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

---

## Matrix pass

| Check | Result |
|-------|--------|
| All 7 patch commits apply clean | OK |
| Live Activity files/plugins/dep gone; archive not in repo | OK |
| `tsc --noEmit` | OK |
| subscription-status, payment-gate, household-entitlement, access-gate, pack-parity, credits-buy, premium-ui, shopping-run-ui, shared-device-one-flow, settings-signout | PASS |
| Trial grace = 0 on household row | OK |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged from 121) |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (122)** — make-v37 |
| Branch | `cursor/make-v37-c30d` |
| Prior (121) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/9d650e20-249f-4214-ae59-67b73434b9b2 |

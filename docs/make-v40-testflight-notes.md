# make-v40 TestFlight — release notes (build 129)

**Branch tip:** `cursor/make-v40-c30d`  
**Base:** make-v39 / TF **1.3.0 (128)**  
**Status:** **1.3.0 (129)** finished + ASC submit scheduled/finished.

---

## What's in this build (on top of 128)

### Subscribe / paywall
- Cleaner **40% OFF** savings badge — theme-gradient pill, white letters, soft shine (no stacked garbled text)
- Account button already fixed on tip (in top-bar flow, tappable)

### Tasks follow renames
- Migration trigger: renaming a member updates their tasks’ `assignee_name` / `assignee_member_id`
- One-time repair of drifted rows; local store renames tasks too
- Task page: orphaned assignee → explain + **Take it**

### Free trial once, ever
- `households.trial_used_at` + `profiles.trial_used_at` (permanent; clients cannot clear)
- `sync-entitlement` stamps on first trial; paywall uses household/person marks (+ device ledger) so “Start free trial” does not return after a trial ran out
- **Note:** if a trial never reached the server, stamp your household/profile `trial_used_at` by hand in Supabase for a cross-device guarantee

### Staging applied this cut
- Migrations: `20261020090000_task_assignee_follows_rename`, `20261020100000_trial_used_forever`
- Edge: `sync-entitlement` **v2** redeployed (`verify_jwt: true`)

---

## Matrix pass

| Check | Result |
|-------|--------|
| `git am` 0001–0003 | OK |
| Staging SQL (both migrations) | Applied |
| `sync-entitlement` redeploy | v2 ACTIVE |
| `tsc --noEmit` | OK |
| `lib/billing/*.test.ts` + rename-assignee | PASS (47) |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged) |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (129)** |
| Branch | `cursor/make-v40-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/128 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/928156c2-83a1-452a-ba98-688f005e374c |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/066831c0-57e9-4f63-9ed1-a2d5001a6719 |
| Prior (128) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/c6897bbd-d436-4697-87e6-e506760e54ab |

# Revision F — Completion Report (§14)

**Branch:** `cursor/choremaxx-make-v10-5f8f`  
**Date:** 2026-08-10  
**Companions applied:** Master Brief, Rev C–F, v2 cursor spec, grocery categories JSON, task library JSON.

## PREREQUISITE · §1 Duplicate occurrences

| Gate | Result | Evidence |
|---|---|---|
| F1.1 Unique constraint | PASS | `tasks_definition_occurrence_uidx` + in-memory `assertUniqueOccurrenceInsert`; migration `20260810120000_revision_f_occurrence_cleanup.sql` |
| F1.2 Four completes → one row | PASS | `npm run test:revision-f` |
| F1.3 Rollover twice identical | PASS | status `Expired` + stable `expiredAt` |
| F1.4 Cleanup 3× → 1 | PASS | `dedupeOccurrences` keeps completed, deletes rest |
| F1.5 True counter | PASS | deduped `done of total` |

`spawnNextOccurrence` remains a hard null (completion never spawns). Catch-up uses `upsertOccurrence`.

## ITEM 1 · Scroll (§2)

| Gate | Result | Notes |
|---|---|---|
| F2.1 Persistent indicator | PARTIAL | `PersistentScrollView` accent@40% on Tasks, House Rules, Assign, Recess, Champions Record, Rewards ledger surfaces; remaining surfaces still migrating |
| F2.2 Hidden when fits | PASS | `show = content > viewport + 4` |
| F2.3 Wheel fade | EXISTING | `XpWheel` / wheel affordances from Rev D |
| F2.4 Screenshots | PENDING | Expo Go visual capture not attached this run |

## ITEM 2 · Per-member invites (§3)

| Gate | Result | Notes |
|---|---|---|
| F3.1 Household QR removed | PASS | `app/invite-household.tsx` redirects to Members |
| F3.2 Per-member QR/link | PASS | `MemberInviteSheet` on Members |
| F3.3 7-day expiry message | PASS | `test:revision-f-features` |
| F3.4 Single-use | PASS | |
| F3.5 Regenerate revokes | PASS | |
| F3.6 Helper API blocked | PARTIAL | UI admin-gated; server RLS still needs invite table migration on Supabase |
| F3.7 Multi-device | PASS | redeem adds profile; no remove-others |
| F3.8 Already on device | PASS | `alreadyOnDeviceMessage` |

## ITEM 3 · Hold & Request (§4)

| Gate | Result | Notes |
|---|---|---|
| F4.1 Hidden for admins | PASS | Rewards “Hold & Request” helper-only |
| F4.2–F4.8 Gate + rate limit | PASS | `lib/rewards/can-request-reward.ts` + tests; claim path shows exact blocked copy |
| F4.9 Ledger row | EXISTING | `requestRewardRedemption` / `claimReward` → rewards repository |

## ITEM 4 · Expired tab (§5)

| Gate | Result | Notes |
|---|---|---|
| F5.1 Three tabs, Expired last | PASS | Active · Completed · Expired on Tasks |
| F5.2 Absent from Active | PASS | `isActiveTask` filter |
| F5.3 8-day hide | PASS | `isExpiredVisibleInTab` |
| F5.4 Rows kept | PASS | view filter only |
| F5.5 Champion’s Record | PASS | filter does not delete |
| F5.6 Non-interactive | PASS | `interactive={false}` |

## ITEM 5 · Share household invite (§6)

| Gate | Result | Notes |
|---|---|---|
| F6.1 “Open full members screen” | PASS | replaced in Settings |
| F6.2 Full-width filled button | PASS | Settings primary CTA + helper “Pick who you're inviting.” |

## ITEM 6 · Contrast (§7)

| Gate | Result | Notes |
|---|---|---|
| F7.1–F7.3 Token audit | PENDING | Measured contrast table not produced this run; offenders listed in Rev F remain follow-up |

## ITEM 7 · Full member creation (§8)

| Gate | Result | Notes |
|---|---|---|
| F8.1–F8.4 Onboarding wizard reuse | PENDING | Invite flow now post-create; full 4-step reuse still to wire on Add member |

## ITEM 8–9 · Assign rebuild + shortName (§9–10)

| Gate | Result | Notes |
|---|---|---|
| F9 Assign page sticky footer | PASS | `app/assign-task.tsx`; Tasks `+` opens it |
| F9.1 Remove Custom/Create/Quick presets from primary | PARTIAL | Primary `+` no longer opens create-task; create-task remains reachable for custom |
| F10.3 shortName | PASS | All 15 domains in `choremaxx-task-library.json` |
| F10.1–F10.2 Frequency picker on rows | PARTIAL | Assign shows XP · frequency; full More picker UI deferred |

## ITEM 10 · No XP cost + Create allowance (§11)

| Gate | Result | Notes |
|---|---|---|
| F11.1 Mint copy | PASS | Exact Rev F sentence |
| F11.2 Create allowance screen | PASS | `app/create-allowance.tsx` Daily/Weekly/Monthly |
| F11.3–F11.4 Progress bar / all-or-nothing payout | PARTIAL | Screen + copy shipped; period-close engine still uses existing allowance ledger hooks |

## ITEM 11 · Assignee-only complete (§12)

| Gate | Result | Notes |
|---|---|---|
| F12.1 Own only | PASS | `completeTask` + Tasks toggle + task detail checkbox |
| F12.2 Unassign incomplete | PENDING | Remove for today / permanently UI not finished |
| F12.3 Permission matrix | DOCUMENTED | Rev F §12.3; code paths align for complete / Hold & Request / invites |

## ITEM · House Rules (§13)

| Gate | Result | Notes |
|---|---|---|
| R30–R33 | PASS | Added to `data/house-rules.json` (33 rules); `test:house-rules` green |
| Kid one-screen | REPORT | With 4 new reward/deadline/household rules, Kid At-a-glance may need a scroll on small phones — **reported, type not shrunk** |

## Leftovers from C / E

- `homeworkProofRequired` on child members (default true in mock).
- Chore create path keeps `proofRequired: false` (homework only).
- Mint “No XP cost” removed.
- Missed → Expired vocabulary in rollover + UI.

## Product overrides preserved (Master Brief / v10)

- Canada grocery catalog + Smart Shopping retained (additive over Rev C simple list).
- Monthly rescue token product override retained; Q2 free-first still awaiting product answer.
- House Rules 4-view IDs preserved; R30–R33 mapped into existing schema.

## Commands

```
npm run test:revision-f
npx tsx lib/revision-f-features.test.ts
npm run test:house-rules
npm run test:recurring
```

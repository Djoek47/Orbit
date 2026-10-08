# Choremaxx full logic audit — make-v32

**Audience:** product owner + implementers. This is **behavior vs house rules**, not a code-style review.  
**Sources of truth (precedence):** Master Brief §3 → Rev F → Rev D → `data/house-rules.json` → companions.  
**Date:** 2026-10-06 · Branch: `cursor/make-v32`

How to read each row: **Rule** (what should happen) → **App today** → **Verdict**.

---

## 0. Verdict in one screen

| Domain | Verdict | One-line |
|--------|---------|----------|
| Create / assign tasks | Mostly PASS | Admin-gated; late assign already rolls to tomorrow |
| Edit / Who / reassign | FIXED this pass | Who restored in Edit; smart reassign after deadline → tomorrow; streak-safe handoff |
| Complete | CONFLICT → patched UI | Store was correct (assignee-only); detail UI wrongly offered admin Complete — removed |
| Proof / XP timing | PASS | XP on Complete; approval does not gate XP (EARN-03) |
| Late Credit / expiry | MIXED | Single-assignee Late Credit OK; **split Late Credit off**; expiry OK |
| Streaks / Rescue / cliffs | **CRITICAL GAP** | Engine exists; **production rollover never runs cliffs/rescue** |
| Shared-device / Sidekick | PASS (core) | Face switch + own complete; no assign |
| Rewards / Hold & Request | PASS (core) | Gate + approval layers |
| Unassign (Rev F §12.2) | GAP | Helpers exist; no Remove today / permanently UI |
| Expired cleanup DEAD-08 | UNCLEAR | Tab hides after 7 days; auto-delete job not found |

---

## 1. Create task

| Step | Rule | App today | Verdict |
|------|------|-----------|---------|
| Who can create | Admins only (EARN-06) | `canAssignOrEditTask` / `canCreateTask` | PASS |
| Chore XP | 5–30 ladder (EARN-01) | XP wheel + library | PASS |
| Hygiene | 0 XP, streak-oriented (EARN-05) | Library `tracking` / hygiene settings | PASS (library) |
| Homework proof | Per Sidekick default | `proofRequiredForHomeworkAssign` | PASS |
| Chore proof | Prefer on-demand Request proof | Create still has Request proof toggle | LOW GAP |
| After deadline assign | First occurrence tomorrow | `resolveAssignOccurrence` | PASS |

**What happens if…**
- Admin assigns “Unload dishwasher” at 20:00 with 19:00 deadline → **Tomorrow**, full window.
- Sidekick opens Create → blocked.

---

## 2. Assign / Who’s on

| Step | Rule | App today | Verdict |
|------|------|-----------|---------|
| Assign sticky page | Rev F Assign rebuild | `app/assign-task.tsx` | PASS |
| Frequency on assign | Does not rewrite library | Occurrence fields only | PASS |
| Series definition | Stable `definitionId` | Stamp on create/edit | PASS |
| Shared-device | Switch face; no admin assign | Denied create/assign | PASS |

---

## 3. Edit + reassign (product ask)

### Intended rules (this pass — aligned to DEAD / EARN / Rev F)

| When | What happens |
|------|----------------|
| Open task, **before** daily deadline | Reassign **same day**. Previous assignee drops out of today’s streak denominator. New person gets full XP if they finish on time. |
| Open task, **after** daily deadline (overdue / late window) | Reassign **rolls to tomorrow** (`Pending`, new `dueAt`). Does **not** expire tonight on the new person. Previous assignee **does not take a miss** for the handoff. |
| Completed | Blocked — use Mark not done |
| Expired | Blocked — assign a fresh occurrence (question: revive-as-tomorrow?) |
| Series | This occurrence follows the plan; future open days also get the new assignee |

### App before this pass
- Who chips existed on **view** detail, but **Edit (pencil) had no Who** → felt “gone while editing”.
- Separate “Reassign (overdue)” only when state = overdue; no next-day roll; no permission gate on `reassignTask`.

### App after this pass
- Who chips in **Edit** and view; both call `planTaskReassignment` + `reassignTask`.
- After deadline → tomorrow; admin-only; confirm copy explains streak safety.

**What happens if…**
- Emma overdue at 19:30; admin gives to Jack → Jack’s list **Tomorrow**; Emma’s day no longer carries that row as a miss.
- Admin reassigns before 19:00 → same day for Jack; Emma off the hook immediately.

---

## 4. Complete

| Step | Rule | App today | Verdict |
|------|------|-----------|---------|
| Who may Complete | Assignee only — admins included (EARN-04, Rev F §12.1) | Store enforces; **detail UI used to show Complete for any admin** | **UI FIXED** this pass |
| When XP lands | Instant on Complete (EARN-03) | `completeTask` awards immediately | PASS |
| Late Credit | Table after deadline, before expiry (DEAD-03) | Single path uses `LATE_CREDIT` | PASS |
| Split Late Credit | Same table | Split path forces `latePenalty = 0` | **CONFLICT** |
| Shared-device Complete | Active face only | `taskMatchesAssignee(currentMember)` | PASS |

**What happens if…**
- Admin opens Liam’s open chore → no Complete (must reassign or wait).
- Liam completes after 19:00 → Late Credit XP; streak still eligible for that day if all qualifying done.

---

## 5. Proof

| Step | Rule | App today | Verdict |
|------|------|-----------|---------|
| XP vs proof | XP never waits on approval | Award before/without proof approve | PASS |
| Request proof | Admin, on-demand, chores | `requestAnotherProof` | PASS |
| Mark not done | Admin reverses XP | `markNotDone` | PASS |

---

## 6. Deadlines & expiry

| Step | Rule | App today | Verdict |
|------|------|-----------|---------|
| Default deadline | 19:00 household-local (DEAD-01) | Settings + House Rules token | PASS |
| Expiry | 23:59:59 → Expired, cannot complete (DEAD-04) | Rollover / boundary | PASS |
| Weekly/monthly miss | XP loss, **no** streak break (DEAD-06) | Intended in streak classifier | Library PASS / live GAP (see §7) |
| Expired tab | Visible 7 days (DEAD-05) | Filter | PASS |
| Auto-delete | After 7 days (DEAD-08) | No purge job found | GAP / UNCLEAR vs Rev F keep-rows |

---

## 7. Streaks & Rescue — CRITICAL

| Step | Rule (Master Brief §3.5–3.6 / STRK-*) | App today | Verdict |
|------|----------------------------------------|-----------|---------|
| Qualifying frequencies | Daily + weekdays only | `countsTowardDailyStreak` frequency filter | PARTIAL (hygiene filter unclear) |
| Day classes | complete / missed / neutral / recess | `classify-day` + streak-engine | Built |
| Cliffs | 3 consecutive **or** 3 in rolling 7 | Engine | Built |
| Rescue | 10% week gross **per** rescued day, max 2 | Engine + UI hooks | Built |
| **Production wiring** | Rollover must classify + offer Rescue | Store uses `awardDailyStreakIfNeeded` only; **never calls `applyMemberDayClass` / cliffs** | **CRITICAL GAP** |
| Neutral days | Skip counters (not preserve-and-increment) | Live award path no-ops on zero tasks; gaps reset simply | CONFLICT with cliffs |
| Hygiene vs chore streak | EARN-05 says hygiene builds streaks; older companion said hygiene independent of chore streak | Frequency-only qualify | **OPEN QUESTION** |

**What happens if… (intended vs live)**
- Miss 1 day → Rescue offer at rollover → **intended**; **live: streak number often just stalls/resets without Rescue**.
- Miss 3 consecutive → streak gone permanently → **intended**; **live: not enforced by cliffs**.

---

## 8. Shared-device user

| Action | Expected | Live |
|--------|----------|------|
| Switch face | Becomes that person | PASS |
| Complete | Only tasks for active face | PASS |
| Create / assign / settings admin | No | PASS |
| Sign out device | Presence disconnect + device copy | PASS (prior audit) |

---

## 9. Sidekick vs Admin

| Action | Admin | Sidekick | Live |
|--------|:-----:|:--------:|------|
| Assign / edit / reassign | ✅ | ❌ | PASS |
| Complete own | ✅ | ✅ | PASS |
| Complete others | ❌ | ❌ | Store PASS; UI fixed |
| Request proof / confirm | ✅ | ❌ | PASS |
| Hold & Request reward | ❌ | ✅ (gated) | PASS |
| Unassign Remove today/permanently | ✅ | ❌ | **UI GAP** |

---

## 10. Rewards / credits / IAP (logic only)

| Action | Expected | Live |
|--------|----------|------|
| Claim reward | Hold & Request gate; approval layer | PASS core |
| Buy token pack | Admin; server grant; StoreKit verify before public | AuthZ added; StoreKit verify still TODO |
| Credits never expire | Ledger consume oldest-first | PASS intent |

---

## 11. Sign-in / sign-out / household (logic)

| Action | Expected | Live (recent) |
|--------|----------|----------------|
| Admin sign-out | Confirm → dismiss Settings → wipe → Get Started | PASS |
| Shared-device sign-out | Device leave, not household delete | PASS |
| Join with code | Edge service role; active join | PASS (with RLS harden) |
| Create household | Owner bootstrap member | PASS with new RLS exception |

---

## 12. Top gaps ranked

1. **CRITICAL** — Streak cliffs + Rescue not driven by production rollover  
2. **HIGH** — Split-task Late Credit disabled (`latePenalty = 0`)  
3. **HIGH** — Unassign UI missing (Rev F §12.2 Remove today / permanently)  
4. **HIGH** — Hygiene vs daily streak denominator still ambiguous vs EARN-05  
5. **MEDIUM** — DEAD-08 auto-delete vs keep-for-history  
6. **MEDIUM** — StoreKit verify before public token grants  
7. **LOW** — Chore proof toggle on create vs on-demand Request proof  

---

## 13. Decisions (locked 2026-10-06)

| # | Decision | Shipping behavior |
|---|----------|-------------------|
| 1 | **New assign only** — no revive of Expired | Expired stays Expired; assign a fresh occurrence |
| 2 | **Hygiene B** | Hygiene does **not** feed the chore daily streak (`countsTowardDailyStreak`) |
| 3 | **Smart reassign grace** | New person: full XP tonight **or** next day until deadline; unfinished night **carries** (no expire that night); Late Credit only if late on **day 2**. Normal (non-reassigned) Late Credit window unchanged through expiry. |
| 4 | **This occurrence only** | Handoff does not rewrite future series days |
| 5 | **Reassign enough for now** | Unassign UI deferred |
| 6 | **Hide after 7 days, keep history** | Expired tab filters; rows remain for household health / history |
| 7 | **Same Late Credit table for splits** | Split shares dock like solo |
| 8 | **Yes — wire cliffs / Rescue** | Rollover calls `applyRolloverStreaksForDay` (engine was built; live path was the gap) |

### Why #8 (Rescue / cliffs) is better than leaving the simple streak

House Rules already tell kids: three misses end it; Rescue costs 10% per day. The **engine for that already exists** (`lib/streaks/streak-engine.ts`) with tests. What was broken is that production only did “all today’s chores done → +1”, so:

- Rescue sheets almost never got real offers  
- Cliffs never fired  
- The in-app House Rules chapter described a product you didn’t actually run  

Wiring rollover → classify day → `applyDayToStreak` makes the rules true without rewriting them. That’s why it’s P0: **stop lying to the household about streaks.**

Normal completion Late Credit still works until expiry (deadline = full XP boundary; after = Late Credit; night close = Expired). Reassign is the special grace path above.

---

## 14. Files for this decision pass

- `lib/tasks/reassign-policy.ts` — grace / carry / effective due  
- `lib/tasks/expire-at-boundary.ts` + `recurring.ts` — carry instead of expire once  
- `lib/scoring/counts-toward-daily-streak.ts` — hygiene B  
- `lib/streaks/apply-rollover-streaks.ts` — live cliffs / Rescue hook  
- `store/orbit-store.tsx` — split Late Credit + rollover streak sync  
- `app/task/[id].tsx` / `app/(tabs)/tasks.tsx` — copy + expired history note  

# ChoreMaxx — Revision D
## Scoring Engine · Crowns · Recess · House Rules

**Read this entire section before writing a single line of code.**

---

# ⛔ EXECUTION PROTOCOL — READ FIRST

This document is written as **five sequential phases**. Each phase ends with a **STOP GATE**.

```
RULES OF ENGAGEMENT

1. Work phases in order. 1 → 2 → 3 → 4 → 5. Do not jump ahead.
2. At each STOP GATE, run the listed tests and paste the results
   into your reply BEFORE starting the next phase.
3. Every task has a checkbox. Do not tick a box you have not done.
4. If a rule here contradicts existing code, THIS DOCUMENT WINS.
   Delete the old code. Do not leave both paths in place.
5. If something is genuinely ambiguous, STOP and ask.
   Do not guess and do not silently pick an interpretation.
6. At the very end, fill in the COMPLETION REPORT (§10). It is
   not optional.
```

### Companion documents — both are still in force

| Document | Status |
|---|---|
| `choremaxx-v2-cursor-spec.md` (Revision B) | In force, **except** where §0.2 below supersedes it |
| `choremaxx-revision-c-spec.md` (Revision C) | In force, unchanged |
| `choremaxx-task-library.json` | In force, unchanged |
| `choremaxx-grocery-categories.json` | In force, unchanged |

---

## §0.1 — Known failure modes. Do not repeat these.

These are the specific ways this work usually goes wrong. Each one has a checkbox in §10 and you will be asked to confirm it.

| # | Failure | What "done properly" looks like |
|---|---|---|
| F1 | **Adding new logic without deleting the old logic**, leaving two code paths that disagree | Old code is *deleted*, not commented out, not left behind a flag |
| F2 | **Building the UI and skipping the engine**, so screens render but numbers are wrong | Engine first, with tests passing, before any screen is touched |
| F3 | **Hardcoding numbers** in components instead of importing constants | Every number in this doc lives in exactly one constants file |
| F4 | **Skipping database migrations**, so the code expects columns that don't exist | Every new field has a migration with a default backfill |
| F5 | **Ignoring timezones**, computing "midnight" from the device rather than the household | All day-boundary math uses `household.timezone` |
| F6 | **Only building the happy path** — no empty state, no zero state, no tie state | Every screen in §7 has its empty and edge states specified and built |
| F7 | **Declaring done without running the tests** | Test output pasted at each STOP GATE |
| F8 | **Renaming a display string but leaving the old one elsewhere** | Repo-wide grep confirms zero occurrences of retired terms |

---

## §0.2 — What this document REPLACES

**These are live contradictions. If you leave the old rule in place, the app will be wrong.**

| Rule | ❌ OLD — delete this | ✅ NEW — this is correct |
|---|---|---|
| Late completion XP | Full XP | **Reduced XP per the Late Credit table (§1.2)** |
| Task after 23:59 | Still completable at full XP | **Expired. Cannot be completed at all (§1.3)** |
| Streak rescue price | −15% / −30% / −50% | **−10% per rescued day, max 2 days (§1.5)** |
| Streak break trigger | One missed day | **3 consecutive misses, OR 3 misses in a rolling 7 days (§1.4)** |

**Task 0.2.a** — [ ] Open `choremaxx-v2-cursor-spec.md` §5.2.6. Everything about "full XP" for late and missed completions is void. Find the corresponding code and delete it.

**Task 0.2.b** — [ ] Search the codebase for `0.15`, `0.30`, `0.50`, `15%`, `30%`, `50%` in any streak or redemption context. Delete every occurrence. The only percentages in the streak system are now **10%** and **20%**.

---

## §0.3 — Vocabulary. Use these exact terms everywhere.

Retire the old words completely. User-facing strings, code identifiers, comments, and analytics events.

| ❌ Retire | ✅ Use | Applies to |
|---|---|---|
| Late penalty, late completion | **Late Credit** | The reduced-XP award for finishing after the deadline |
| Missed | **Expired** | A task that passed 23:59 uncompleted |
| Streak redemption, buy back | **Streak Rescue** | Paying XP to preserve a streak |
| Vacation mode | **Recess** | Pausing tasks while freezing streaks |
| Rules information | **House Rules** | The in-app rules manual |
| Weekly winner | **The Week's Crown** | Weekly XP champion |
| Monthly winner | **Monthly Sovereign** | Monthly XP champion |
| Winner's sheet | **Champion's Record** | The per-member detail sheet |

**Task 0.3.a** — [ ] Create `src/constants/vocabulary.ts` exporting every user-facing term above. No component contains a hardcoded copy of any of these words.

---

# PHASE 1 — THE SCORING ENGINE

**This is the foundation. Nothing else in this document works if this is wrong. Build and test it completely before touching any screen.**

## §1.1 — Constants file (do this first)

**Task 1.1.a** — [ ] Create `src/constants/scoring.ts` with exactly this content. Every other file imports from here. **No file may redefine any of these numbers.**

```ts
// ─────────────────────────────────────────────────────────────
// ChoreMaxx scoring constants — Revision D
// This is the ONLY place these numbers exist.
// ─────────────────────────────────────────────────────────────

/** Late Credit: XP awarded when a task is completed after its
 *  deadline but before 23:59 the same day.
 *  Key = the task's full XP value. Value = what late earns.
 *  These six keys are the ONLY valid XP values in the app. */
export const LATE_CREDIT: Record<number, number> = {
  5:  3,
  10: 7,
  15: 12,
  20: 16,
  25: 20,
  30: 25,
};

/** Bundle bonus (Revision B §4.1) at full and late rates. */
export const BUNDLE_BONUS_FULL = 10;
export const BUNDLE_BONUS_LATE = 7;   // = LATE_CREDIT[10]

/** Hour of day, household-local, when tasks expire. 23:59:59. */
export const EXPIRY_HOUR = 23;
export const EXPIRY_MINUTE = 59;

/** Streak Rescue costs 10% of the week's gross XP, PER RESCUED DAY. */
export const RESCUE_COST_PCT_PER_DAY = 0.10;

/** Maximum consecutive days that can be rescued. The 3rd
 *  consecutive miss ends the streak permanently. */
export const MAX_RESCUABLE_CONSECUTIVE_DAYS = 2;

/** A streak also ends if this many days are missed inside a
 *  rolling window, even when not consecutive. */
export const ROLLING_MISS_LIMIT = 3;
export const ROLLING_MISS_WINDOW_DAYS = 7;

/** The first Streak Rescue a member ever accepts is free.
 *  See §1.5.6. */
export const FIRST_RESCUE_IS_FREE = true;

/** Week runs Monday 00:00:00 → Sunday 23:59:59, household-local. */
export const WEEK_STARTS_ON = 1; // 1 = Monday

/** How many days back an admin may backdate Recess. */
export const RECESS_BACKDATE_DAYS = 3;

/** Minutes before a deadline that the final reminder fires. */
export const DEADLINE_REMINDER_MINUTES = 30;
```

**Task 1.1.b** — [ ] Grep the repo for any other definition of these numbers. Delete every duplicate.

---

## §1.2 — Late Credit

### The rule

A task completed **after its deadline but before 23:59:59 the same household-local day** earns **Late Credit** instead of full XP.

| Full XP | Late Credit | Lost |
|:---:|:---:|:---:|
| 5 | **3** | −2 |
| 10 | **7** | −3 |
| 15 | **12** | −3 |
| 20 | **16** | −4 |
| 25 | **20** | −5 |
| 30 | **25** | −5 |

### How it is applied

XP is awarded **the instant the child taps Complete** (Revision B §1.7 — unchanged). So the reduction happens at that moment. There is no later adjustment, no pending state, no recalculation.

```
Task worth 10 XP, due 19:00

  Child taps Complete at 18:45  →  +10 XP   (on time)
  Child taps Complete at 19:30  →  +7  XP   (Late Credit)
  Child taps Complete at 23:58  →  +7  XP   (Late Credit)
  Child taps Complete at 00:01  →  IMPOSSIBLE — task expired
```

**Task 1.2.a** — [ ] Implement `calculateAward(task, completedAt): number`. It returns the full XP if `completedAt <= dueAt`, otherwise `LATE_CREDIT[task.xp]`.

**Task 1.2.b** — [ ] Set `occurrence.awardedXp` to this value at completion time and persist it. **Never recompute it later** — a snapshot, exactly as Revision B §4.1 requires.

**Task 1.2.c** — [ ] Set `occurrence.completedLate = true` when Late Credit applied.

### Scope — apply to all of these

- [ ] **Chores** — yes
- [ ] **Homework** — yes, identical treatment
- [ ] **Equity mode** — yes. Every task is 10 XP, so late = 7 XP.
- [ ] **Bundle bonus** — if *any* task in the group was completed late, the group bonus pays `BUNDLE_BONUS_LATE` (7) instead of `BUNDLE_BONUS_FULL` (10).
- [ ] **Hygiene / streak-tracked tasks** — **NO.** They award 0 XP either way. Late Credit is meaningless for them. Do not apply it, do not show a Late Credit label on them.

### The UI

On a late-completed task card, show the earned value and the forgone value together. The child should understand *what happened*, not just see a smaller number.

```
✅  Wipe down kitchen counters          +7 XP
    Completed late · 7:42 PM            was 10
```

Style `was 10` as muted and small. **No red. No warning icon. No exclamation mark.** This is information, not a scolding.

**Task 1.2.d** — [ ] Build the late-completed card state exactly as above.

---

## §1.3 — Expiry at 23:59

### The rule

**Every task expires at 23:59:59 household-local on its due date.** After that it cannot be completed by anyone, for any amount of XP.

```
19:00 ─────────────── 23:59:59 │ 00:00 ──────────
  deadline                     │  new day
      ↓                        │      ↓
  status: 'late'               │  status: 'expired'
  ✅ completable               │  ❌ NOT completable
  💰 Late Credit               │  💰 nothing, ever
```

**Task 1.3.a** — [ ] Add `'expired'` to the occurrence status enum. Full enum is now:
`'pending' | 'late' | 'completed' | 'expired'`

**Task 1.3.b** — [ ] **Delete the `'missed'` status entirely.** Migrate every existing `'missed'` row to `'expired'`. Grep for `'missed'` and remove all references.

**Task 1.3.c** — [ ] The Complete button must be **absent** (not disabled) on an expired task. Do not render a control that cannot work.

**Task 1.3.d** — [ ] The rollover job at 00:00 household-local sets `status = 'expired'` on every `pending` or `late` occurrence whose `dueAt` is in the past. **This job must be idempotent** — running it twice must not change anything the second time.

### Which frequencies expire, and what expiry costs

| Frequency | Expires 23:59? | Breaks the daily streak? |
|---|:---:|:---:|
| `daily` | ✅ Yes | ✅ **YES** |
| `weekdays` | ✅ Yes | ✅ **YES** |
| `2x_weekly` | ✅ Yes | ❌ No |
| `weekly` | ✅ Yes | ❌ No |
| `biweekly` | ✅ Yes | ❌ No |
| `monthly` | ✅ Yes | ❌ No |
| `quarterly` | ✅ Yes | ❌ No |
| `seasonal` | Only once triggered | ❌ No |
| `as_needed` | Only once triggered | ❌ No |

> ### ⚠️ THIS IS THE MOST COMMONLY MIS-IMPLEMENTED RULE IN THIS DOCUMENT
>
> **ONLY `daily` AND `weekdays` TASKS AFFECT THE DAILY STREAK.**
>
> A missed weekly or monthly task costs its XP and appears as *Expired* on the Champion's Record. It **does not** break a 40-day streak. A streak measures daily consistency; forgetting to mow the lawn is not a failure of daily consistency.

**Task 1.3.e** — [ ] Implement `countsTowardDailyStreak(occurrence): boolean` returning true **only** for `daily` and `weekdays`. Every streak calculation calls this. Write it as one function called from one place — do not inline the check.

---

## §1.4 — When a streak breaks: the two cliffs

A member's daily streak ends when **either** cliff is reached.

```
┌─────────────────────────────────────────────────────────┐
│  CLIFF 1 — CONSECUTIVE                                  │
│  3 missed days in a row  →  streak gone, permanently    │
│                                                         │
│  CLIFF 2 — ROLLING                                      │
│  3 missed days inside any 7-day window                  │
│                          →  streak gone, permanently    │
└─────────────────────────────────────────────────────────┘

        One line for the House Rules manual:
   "Three misses and the streak is gone — in a row, or in a week."
```

Cliff 2 exists to close a specific hole: without it, a child could miss every other day forever, paying 10% each time, and hold a 60-day streak built on four working days a week.

### What counts as a "missed day"

A day is **missed** when it had at least one `daily` or `weekdays` task due, and **at least one of them expired uncompleted**.

**Task 1.4.a** — [ ] Implement `classifyDay(memberId, date)` returning exactly one of:

| Result | Condition | Effect on consecutive counter |
|---|---|---|
| `'complete'` | All qualifying tasks completed (on time **or** late) | **Resets to 0** |
| `'missed'` | ≥1 qualifying task expired uncompleted | **Increments** |
| `'neutral'` | No qualifying tasks were due | **Skipped — neither** |
| `'recess'` | Member was on Recess (§3) | **Skipped — neither** |

> ### ⚠️ NEUTRAL AND RECESS DAYS ARE SKIPPED, NOT COUNTED
>
> They do **not** count as a miss and do **not** reset the counter. They are invisible to the streak.
>
> Concretely: miss Monday → nothing due Tuesday → miss Wednesday = **2 consecutive**, not 1. A quiet Sunday must never silently rescue or silently break a streak.

**Task 1.4.b** — [ ] Implement both cliff checks. Evaluate at the 00:00 rollover, after `classifyDay` has run for the day that just ended.

**Task 1.4.c** — [ ] When either cliff is reached, set the streak to 0 and record `streakEndedAt` and `streakEndedReason: 'consecutive' | 'rolling'`. **Offer no Rescue** — at the cliff the streak is gone and cannot be bought back.

**Task 1.4.d** — [ ] A completed day resets the consecutive counter to 0. It does **not** clear the rolling-7 window; that window ages out naturally, one day at a time.

---

## §1.5 — Streak Rescue

### The offer

At the 00:00 rollover, if a member missed a day and has **not** hit either cliff, offer them a Streak Rescue.

| Consecutive missed days | Offer |
|:---:|---|
| **1** | Rescue available — costs **10%** of that week's gross XP |
| **2** | Rescue available — costs a **further 10%** of that week's gross XP (20% across the gap) |
| **3** | ❌ **No offer.** Streak is gone permanently. |

### Pricing — read this carefully

> **The price is 10% of the week's gross XP, charged PER RESCUED DAY.**
>
> Do not implement this as "10% for a 1-day gap, 20% for a 2-day gap." Implement it as **10% per day, maximum two days.** The arithmetic is identical inside a week, and the per-day formulation handles a gap that straddles a Sunday/Monday boundary without any special case.

**Each rescued day is charged to the week that day falls in.**

- Gap of 1 day → 10% of that day's week.
- Gap of 2 days, both in the same week → 10% + 10% = 20% of that week.
- Gap of 2 days straddling the week boundary → 10% of week 1, 10% of week 2.

**Task 1.5.a** — [ ] Implement pricing as per-day accrual, not as a gap-length lookup.

### Timing

| | |
|---|---|
| **Offered** | Immediately at 00:00 rollover |
| **Decision** | Resolves instantly — the child knows their streak status right away |
| **Charged** | At week close (Sunday 23:59:59), against that week's **gross** XP |
| **Base** | Gross XP earned Mon 00:00 → Sun 23:59:59, **before** any deductions |

Booking the decision immediately but settling at week close does two things: the child is never left in limbo for five days, and the price cannot be gamed by rescuing on a Monday when the week's total is near zero.

**Task 1.5.b** — [ ] Store the accepted rescue as a percentage owed against the week, not as an absolute XP figure at the time of acceptance.

**Task 1.5.c** — [ ] At week close, compute `deduction = round(weekGrossXp × totalRescuePct)` and write it to the ledger (§1.6).

### Inaction

**Task 1.5.d** — [ ] If the member never responds, the offer expires at the **next** 00:00 rollover and defaults to **DECLINE**.

> ### ⚠️ INACTION MUST NEVER COST XP
>
> A child who doesn't open the app loses their streak. They do **not** lose points. Defaulting to "accept" would charge a child for not tapping a button, which is indefensible.

### What a Rescue does and does not do

| | |
|---|---|
| Streak survives the gap | ✅ Yes |
| The missed day is credited to the streak count | ❌ **No** |
| Expired tasks become completable again | ❌ **No** |
| XP for those expired tasks is recovered | ❌ **No** |

**Worked example.** A child on a 12-day streak misses day 13 and accepts a Rescue. Their streak stays at **12**. Completing day 14 takes them to **13**. They are not credited a day they did not work.

**Task 1.5.e** — [ ] Implement bridge-not-credit. Assert it in a test.

### The free first Rescue

**Task 1.5.f** — [ ] Add `member.freeRescueUsed: boolean`, default `false`. The first Rescue a member ever **accepts** costs 0 XP and sets the flag to `true`. Every subsequent Rescue is charged normally.

The first broken streak is the moment a child is most likely to give up on the app. Forgiving it once teaches the mechanic without punishing it.

> 📌 **CONFIRM WITH PRODUCT OWNER BEFORE SHIPPING.** This was recommended, not explicitly requested. To remove it, set `FIRST_RESCUE_IS_FREE = false` — the flag exists so this is a one-line change, not a refactor.

### No refunds at the cliff

If a member pays for day 1, pays for day 2, then misses day 3 — the streak is gone and **the 20% is not refunded**. They purchased two days of streak preservation and received them.

**Task 1.5.g** — [ ] Implement no-refund. Add a code comment stating this is deliberate, so a future reader doesn't "fix" it.

### The Rescue screen

Show the **absolute XP cost**, not just the percentage. "−10%" means nothing to a nine-year-old.

```
┌────────────────────────────────────────┐
│                                        │
│   Your 12-day streak is at risk        │
│                                        │
│   You missed Wednesday. You can        │
│   rescue your streak for 26 XP.        │
│                                        │
│   ┌──────────────────────────────┐     │
│   │  Rescue my streak · 26 XP    │     │
│   └──────────────────────────────┘     │
│                                        │
│         Keep my XP instead             │
│                                        │
│   Either way, Wednesday's tasks        │
│   are gone.                            │
│                                        │
└────────────────────────────────────────┘
```

- [ ] **Task 1.5.h** — Compute the displayed cost from **week-to-date gross XP** as a live estimate. Label it honestly: *"about 26 XP"* if the week is still open.
- [ ] **Task 1.5.i** — When the free Rescue applies, the button reads **`Rescue my streak · Free`** with a line beneath: *"Your first rescue is on us."*
- [ ] **Task 1.5.j** — The decline option is a plain text button, never a filled button competing with the primary.

---

## §1.6 — The XP Ledger

**This is required, not optional.** With Late Credit, Rescues, reversals and bundle bonuses, a member's XP will now move for reasons that are invisible. Without a history, this produces arguments between a parent and a child, which no bug report will ever surface.

**Task 1.6.a** — [ ] Create the ledger table.

```ts
interface XpLedgerEntry {
  id: string;
  memberId: string;
  occurredAt: string;          // ISO UTC
  type: 'task_completed'
      | 'late_credit'          // logged alongside task_completed
      | 'bundle_bonus'
      | 'streak_rescue'
      | 'reversal'             // admin marked not done
      | 'adjustment';          // manual admin correction
  delta: number;               // signed. -26 for a rescue.
  balanceAfter: number;
  label: string;               // human-readable, kid-appropriate
  occurrenceId?: string;
}
```

**Task 1.6.b** — [ ] **Every** XP mutation writes a ledger entry. There must be no code path that changes a member's XP without one. Enforce this by routing all XP changes through a single `applyXpChange()` function.

**Task 1.6.c** — [ ] Build the ledger view, reachable from a member's profile and from the Champion's Record.

```
   THIS WEEK

   Mon    Made the bed                        +5
   Mon    Load the dishwasher                +10
   Tue    Wipe down counters      late         +7   was 10
   Wed    ─ no tasks completed ─
   Thu    Do your homework                   +20
   Sun    Streak rescue                      −26

          Week total                         216
```

- [ ] Group by day. Show the running weekly total.
- [ ] Negative entries in a muted tone. **Not red.**
- [ ] Late entries show the forgone amount as `was 10`.
- [ ] Empty state: *"Nothing yet this week."*

---

# 🛑 STOP GATE 1

**Do not begin Phase 2 until every test below passes. Paste the output into your reply.**

```
LATE CREDIT
[ ] T1.1  10 XP task, completed 18:45, due 19:00  →  awardedXp === 10
[ ] T1.2  10 XP task, completed 19:30, due 19:00  →  awardedXp === 7
[ ] T1.3  10 XP task, completed 23:58, due 19:00  →  awardedXp === 7
[ ] T1.4  All six values map: 5→3, 10→7, 15→12, 20→16, 25→20, 30→25
[ ] T1.5  Equity mode, late  →  awardedXp === 7
[ ] T1.6  Bundle with one late task  →  bonus === 7, not 10
[ ] T1.7  Hygiene task, late  →  awardedXp === 0, no Late Credit label

EXPIRY
[ ] T1.8  Task at 00:01 next day  →  status === 'expired'
[ ] T1.9  Expired task cannot be completed via direct API call
[ ] T1.10 Rollover job run twice  →  identical DB state
[ ] T1.11 Zero rows with status 'missed' remain anywhere
[ ] T1.12 Expired WEEKLY task  →  daily streak UNCHANGED
[ ] T1.13 Expired DAILY task   →  day classified 'missed'

STREAK CLIFFS
[ ] T1.14 Miss Mon, Tue, Wed  →  streak 0, reason 'consecutive', NO rescue offered
[ ] T1.15 Miss Mon, work Tue, miss Wed, work Thu, miss Fri
          →  streak 0, reason 'rolling'
[ ] T1.16 Miss Mon, nothing due Tue, miss Wed  →  consecutive count === 2
[ ] T1.17 Complete a day  →  consecutive counter === 0
[ ] T1.18 Complete a day  →  rolling-7 window NOT cleared

STREAK RESCUE
[ ] T1.19 Week gross 260, 1 rescued day  →  deduction === 26
[ ] T1.20 Week gross 250, 2 rescued days →  deduction === 50
[ ] T1.21 Gap straddling Sun/Mon  →  10% charged to EACH week separately
[ ] T1.22 No response by next rollover  →  DECLINED, XP unchanged, streak 0
[ ] T1.23 Streak 12, miss, rescue  →  streak still 12 (not 13)
[ ] T1.24 First ever rescue  →  cost 0, freeRescueUsed === true
[ ] T1.25 Second rescue  →  charged normally
[ ] T1.26 Pay day 1, pay day 2, miss day 3  →  streak 0, NO refund

LEDGER
[ ] T1.27 Every XP mutation in T1.1–T1.26 produced a ledger entry
[ ] T1.28 balanceAfter is continuous with no gaps across the sequence
```

---

# PHASE 2 — CROWNS AND THE CHAMPION'S RECORD

## §2.1 — The two crowns

| Crown | Period | Awarded |
|---|---|---|
| **The Week's Crown** | Monday 00:00 → Sunday 23:59:59 | At week close |
| **Monthly Sovereign** | 1st 00:00 → last day 23:59:59 | At month close |

Both rank on **net XP earned in the period** — after Late Credit, after Rescue deductions, after reversals. The ledger is the source of truth.

**Task 2.1.a** — [ ] Compute both from `XpLedgerEntry` sums over the period. Do not maintain a separate counter that can drift.

## §2.2 — Medals and ties

Standard **competition ranking**. Ties share a rank and consume the ranks below them.

```
   Maya    420 XP   →  1st   🥇 GOLD
   Liam    420 XP   →  1st   🥇 GOLD      ← tied
   Sofia   310 XP   →  3rd   🥉 BRONZE    ← 2nd/silver is NOT awarded
   Noah    180 XP   →  4th
```

**Task 2.2.a** — [ ] Implement competition ranking: `1, 1, 3, 4` — never `1, 1, 2, 3`.

**Task 2.2.b** — [ ] When a rank is shared, label it **`Tied for 1st`** on both cards. Without this label the missing silver reads as a bug.

**Task 2.2.c** — [ ] Sort *within* a tie by: tasks completed → fewest late → name alphabetically. This is **display stability only** — it must not break the tie or change the medal.

**Task 2.2.d** — [ ] Name colours: 1st **gold**, 2nd **silver**, 3rd **bronze**. Ranks 4+ use the standard text colour. All four values live in the theme file, not inline.

**Task 2.2.e** — [ ] Verify gold, silver and bronze each pass **4.5:1** contrast on the app's dark background. Bronze in particular will fail if taken straight from a stock palette — adjust the tone until it passes and note the final hex in your report.

### Zero-XP guard

**Task 2.2.f** — [ ] **If the top-ranked member has 0 XP for the period, award no crown at all.** Show: *"No crown this week — let's go again."* A quiet week must not make everyone a gold-medal champion.

### Recess exclusion

**Task 2.2.g** — [ ] A member on Recess for **any part** of the period is excluded from ranking for that period. Show them in the list, greyed, labelled **`On recess`**, with no rank and no medal.

## §2.3 — The Champion's Record

A per-member detail sheet for the period. Open it from any name on the leaderboard.

```
┌────────────────────────────────────────┐
│  ‹ Ranks          MAYA          Week 32│
│                                        │
│         🥇  1st · 420 XP               │
│                                        │
│  Tasks completed                    31 │
│  On time                            27 │
│  Late                                4 │  ← restricted
│  Expired                             2 │  ← restricted
│                                        │
│  Current streak                 18 days│
│  Streak rescues used                 1 │  ← restricted
│                                        │
│  Best day              Thursday · 85 XP│
│  Busiest domain                 Kitchen│
│                                        │
│         [ View XP ledger ]             │
└────────────────────────────────────────┘
```

### ⚠️ Visibility rules — this is a privacy requirement, not a preference

| Metric | Who can see it |
|---|---|
| XP, rank, medal, tasks completed, on-time count, current streak, best day, busiest domain | **Everyone in the household** |
| **Late count, Expired count, Streak rescues used** | **Admins, and the member themselves. Nobody else.** |

**Task 2.3.a** — [ ] Enforce this **server-side**. A Helper requesting a sibling's record must receive a payload with the restricted fields **absent** — not present-and-hidden, not zeroed. Verify by direct API call.

**Task 2.3.b** — [ ] On the client, restricted rows are omitted entirely for unauthorised viewers. Do not render an empty row or a lock icon; the section simply does not exist for them.

> **Why:** the Fairness metric was removed from this app precisely because it invited siblings to measure each other's failures. Public wins, private struggles.

## §2.4 — Crown history

**Task 2.4.a** — [ ] Persist every awarded crown. A member's profile shows their tally: *"3 weekly crowns · 1 monthly"*. This is the long-term motivator once the novelty of daily XP fades.

---

# 🛑 STOP GATE 2

```
[ ] T2.1  Two members tied at top  →  both 1st/gold, next is 3rd/bronze, no silver
[ ] T2.2  Three tied at top  →  all 1st/gold, next is 4th
[ ] T2.3  Tie shows the "Tied for 1st" label
[ ] T2.4  Leader has 0 XP  →  no crown awarded, correct empty copy
[ ] T2.5  Member on Recess for 1 day of the week  →  excluded, shown "On recess"
[ ] T2.6  Helper requests sibling's record via API
          →  late/expired/rescues fields ABSENT from the response
[ ] T2.7  Admin requests same record  →  all fields present
[ ] T2.8  Member requests own record  →  all fields present
[ ] T2.9  Gold, silver, bronze all pass 4.5:1 contrast (report hex values)
[ ] T2.10 Crown ranking matches the ledger sum exactly
```

---

# PHASE 3 — RECESS

Pauses tasks while freezing streaks. A family goes away for two weeks; a child returns with the streak they left with.

## §3.1 — Scope and control

**Task 3.1.a** — [ ] `member.recessPeriods: RecessPeriod[]` — Recess is **per member**, not per household.

```ts
interface RecessPeriod {
  id: string;
  memberId: string;
  startDate: string;      // 'YYYY-MM-DD' household-local, inclusive
  endDate: string | null; // null = open-ended
  createdBy: string;      // admin id
  createdAt: string;
  isBackdated: boolean;
}
```

**Task 3.1.b** — [ ] Provide an **`Everyone`** shortcut in the UI that writes one period per member. One tap for a family holiday; per-child when only one is away at camp.

**Task 3.1.c** — [ ] **Admin-only.** Enforce server-side. A Helper must not be able to put themselves on Recess.

## §3.2 — Behaviour while on Recess

| | |
|---|---|
| Task occurrences generated | ❌ **None.** Not deferred, not queued, not stacked. |
| Streak value | 🔒 **Frozen at its current number.** |
| Streak counter | ⏸️ Paused. Recess days are `'recess'` in `classifyDay` and are skipped. |
| Days counted as missed | ❌ No |
| Included in crown rankings | ❌ No (§2.2.g) |
| Allowance auto-payment | ❌ **No.** See below. |
| Manual `Send allowance` | ✅ **Yes**, remains available to admins |
| Rewards already earned | ✅ Retained |

> ### ⚠️ DO NOT QUEUE TASKS DURING RECESS
>
> Generate **nothing**. Returning from holiday to twenty backed-up chores punishes a child for having gone away, which is the exact opposite of what this feature is for.

**Task 3.2.a** — [ ] The rollover job skips members on Recess entirely — no generation, no expiry, no classification.

**Task 3.2.b** — [ ] Allowance does not auto-pay during Recess. No work, no automatic wage — but a parent can still choose to be generous via manual send. Deliberate, not accidental.

**Worked example — implement to match this exactly:**

```
Day 0    Maya's streak = 12
Day 1    Recess begins
...      20 days pass, no tasks, no misses
Day 21   Recess ends, streak = 12
Day 22   Maya completes her tasks → streak = 13
```

**Task 3.2.c** — [ ] Assert this exact sequence in a test.

## §3.3 — Backdating

Parents forget to switch it on before they leave. This must be recoverable.

**Task 3.3.a** — [ ] Allow an admin to backdate a Recess start by up to **`RECESS_BACKDATE_DAYS` (3)** days.

**Task 3.3.b** — [ ] Backdating must:
- [ ] Restore any streak broken inside the backdated window
- [ ] **Refund any Streak Rescue paid** inside that window (a ledger `adjustment` entry with a positive delta)
- [ ] Reclassify those days as `'recess'`
- [ ] Recompute the rolling-7 window
- [ ] Set `isBackdated: true` and log the acting admin

**Task 3.3.c** — [ ] Reject any attempt to backdate further than 3 days with a clear message. The cap is what stops Recess becoming an eraser for a bad month.

## §3.4 — Surfacing it

- [ ] **Task 3.4.a** — Settings → Household → **Recess**. Member list, each with a toggle and an optional end date.
- [ ] **Task 3.4.b** — While any member is on Recess, Home shows a calm banner: *"Maya is on recess. Tasks resume Aug 18."*
- [ ] **Task 3.4.c** — The member's own Home shows: *"You're on recess. Your 12-day streak is safe."*
- [ ] **Task 3.4.d** — Ending Recess early is one tap and takes effect at the next rollover.

---

# 🛑 STOP GATE 3

```
[ ] T3.1  Streak 12 → 20 days of Recess → returns as 12
[ ] T3.2  First day back completed  →  streak 13
[ ] T3.3  ZERO occurrences generated during Recess (assert count === 0)
[ ] T3.4  No occurrences queued or backfilled on return
[ ] T3.5  Recess days classified 'recess', excluded from consecutive count
[ ] T3.6  Helper cannot create a Recess period via direct API call
[ ] T3.7  Backdate 2 days → broken streak restored, rescue refunded to ledger
[ ] T3.8  Backdate 4 days → REJECTED with a clear error
[ ] T3.9  Allowance does not auto-pay during Recess
[ ] T3.10 Manual Send allowance still works during Recess
[ ] T3.11 Member on Recess excluded from that week's crown
```

---

# PHASE 4 — HOUSE RULES

An in-app manual, **generated from the household's actual settings**, in two voices.

> ### ⚠️ THIS IS NOT A STATIC HELP PAGE
>
> If the household has XP disabled, the manual must not mention XP. If Late Credit is on, it shows the real table. Every sentence is conditional on configuration. A static page that describes features the family doesn't have is worse than no page at all.

## §4.1 — The rules registry

**Task 4.1.a** — [ ] Create `src/rules/registry.ts`. Every rule is one entry:

```ts
interface RuleEntry {
  id: string;
  section: 'earning' | 'deadlines' | 'streaks' | 'rewards'
         | 'proof' | 'recess' | 'crowns';
  appliesWhen: (h: Household, m?: Member) => boolean;
  adultText: (h: Household, m?: Member) => string;
  kidText:   (h: Household, m?: Member) => string;
  order: number;
}
```

**Task 4.1.b** — [ ] Both views render **only** entries whose `appliesWhen` returns true. Neither view has any hardcoded prose outside the registry.

**Task 4.1.c** — [ ] Populate the registry with every mechanic in the app:

- [ ] XP values and meritocracy vs equity
- [ ] Bundle bonus
- [ ] Deadlines — 19:00 default, weekly Sunday, monthly last Sunday
- [ ] **Late Credit** — render the real six-row table
- [ ] **Expiry at 23:59**
- [ ] Which task types affect the streak (daily and weekdays only)
- [ ] **Both streak cliffs**
- [ ] **Streak Rescue** — pricing, timing, free first rescue if enabled
- [ ] Hygiene tracked as streaks, not points
- [ ] Reward frequencies and approval modes
- [ ] Allowance frequency
- [ ] Photo proof — chores on demand, homework per child
- [ ] Recess
- [ ] Crowns, medals, ties
- [ ] Trophy ladder

## §4.2 — The adult view

Settings → **House Rules**. Sectioned, scannable, complete. Each rule states the mechanic and its current setting, with an inline link to change it where one exists.

**Task 4.2.a** — [ ] Build it. Reachable in **one tap** from Settings.

## §4.3 — The kid view

**Task 4.3.a** — [ ] Build the kid-facing card, reachable from the child's own Home.

> ### 🎯 HARD CONSTRAINT
>
> **The kid view must fit on ONE screen at default text size on a 390pt-wide device, with no scrolling.**
>
> If it does not fit, the rules are too complex — report that rather than shrinking the type or adding a scroll. This constraint is a design check on the whole system, and it is the reason it exists.

Target voice — short, concrete, second person:

```
   HOW IT WORKS

   Finish your tasks by 7:00 PM to get all your points.

   Finish late and you still get most of them.

   After midnight, the task is gone.

   Do every task, every day, and your streak grows.

   Three misses and your streak is gone —
   in a row, or in a week.

   Miss once? You can trade some points to save it.
```

- [ ] Rendered from the same registry via `kidText`. No duplicated copy.
- [ ] No numbers a child can't act on. No percentages.
- [ ] Adapts to configuration exactly as the adult view does.

## §4.4 — Custom house rules

**Task 4.4.a** — [ ] Admins can add free-text rules of their own (*"Screens off at 8:30"*), appearing in a **Our House Rules** section at the top of both views. Plain text, no formatting, 500-character cap, up to 10 entries.

**Task 4.4.b** — [ ] Custom rules are for the family's own conventions. They must not alter any app mechanic. Add a code comment saying so.

---

# 🛑 STOP GATE 4

```
[ ] T4.1  Household on xp_only  →  manual mentions NO money or allowance
[ ] T4.2  Household on allowance  →  manual mentions NO XP
[ ] T4.3  Household on full  →  every section present
[ ] T4.4  Child with homework proof OFF  →  their manual omits the photo rule
[ ] T4.5  Kid view fits one screen at default text size, 390pt wide, no scroll
          (attach a screenshot)
[ ] T4.6  Zero hardcoded rule prose outside registry.ts (grep and report)
[ ] T4.7  Custom house rules appear in both views
[ ] T4.8  House Rules reachable in one tap from Settings
```

---

# PHASE 5 — NOTIFICATIONS AND POLISH

## §5.1 — Notifications from Poppins

> ### ⚠️ BATCH THEM. THIS IS NOT OPTIONAL.
>
> A child with five tasks due at 19:00 must receive **ONE** notification at 18:30, not five.
>
> ```
>  ❌  "Make the bed is due in 30 minutes"
>      "Load the dishwasher is due in 30 minutes"
>      "Do your homework is due in 30 minutes"
>      "Feed the pet is due in 30 minutes"
>      "Tidy your room is due in 30 minutes"
>
>  ✅  "5 tasks due at 7:00 PM"
> ```
>
> Get this wrong and Poppins is muted in week one, taking every other notification with it.

**Task 5.1.a** — [ ] Group by `(memberId, dueAt)` and send exactly one notification per group.

**Task 5.1.b** — [ ] Implement this inventory and nothing beyond it:

| Trigger | Recipient | Copy | Batched |
|---|---|---|:---:|
| 30 min before deadline | Member | `3 tasks due at 7:00 PM` | ✅ |
| Task completed | Admins | `Maya completed Load the dishwasher · +10 XP` | ✅ per 5 min |
| Homework awaiting confirmation | Admins | `Maya's homework is ready to check` | ✅ |
| Proof requested | Member | `Mum asked for a photo of the counters` | ❌ |
| Streak at risk | Member | `Your 12-day streak is at risk` | ❌ |
| Streak rescued / lost | Member | outcome confirmation | ❌ |
| Crown awarded | Everyone | `Maya takes the Week's Crown` | ❌ |
| Reward ready to claim | Member + admins | `Dessert choice is ready` | ❌ |

**Task 5.1.c** — [ ] **Quiet hours 21:00–07:00 household-local.** Nothing sends inside that window except the deadline reminder, which by definition fires at 18:30. Queue anything else to 07:00.

**Task 5.1.d** — [ ] Every category is individually toggleable in Settings → Notifications.

**Task 5.1.e** — [ ] Handle the shared-device case: if several members share one device, deadline reminders name the person — `Maya: 3 tasks due at 7:00 PM`.

**Task 5.1.f** — [ ] Never send to a member on Recess.

## §5.2 — Scroll indicators

**Task 5.2.a** — [ ] Every scrollable surface shows a **persistent, visible scroll indicator** — not the transient iOS default that fades after a second.

Audit and fix **all** of these:

- [ ] Task list
- [ ] Homework list
- [ ] Domain sheets (group → task selection)
- [ ] Reward picker
- [ ] Grocery list and the aisle view
- [ ] Trophy ladder
- [ ] XP ledger
- [ ] House Rules
- [ ] Settings, and every sub-screen
- [ ] Member roster
- [ ] Champion's Record

**Task 5.2.b** — [ ] **Wheel pickers** (frequency, time, amount) cannot show a bar. Use the correct affordance instead: top and bottom fade edges plus a fixed centre selection band, so it is visually obvious the wheel moves.

**Task 5.2.c** — [ ] Style the indicator to the theme. A default grey bar on the dark brown background will look like a rendering artefact.

---

# 🛑 STOP GATE 5

```
[ ] T5.1  Five tasks due at 19:00  →  exactly ONE notification at 18:30
[ ] T5.2  Notification text reads "5 tasks due at 7:00 PM"
[ ] T5.3  Non-urgent notification generated at 22:00  →  queued to 07:00
[ ] T5.4  Member on Recess receives nothing
[ ] T5.5  All 11 scroll surfaces show a persistent indicator (screenshot each)
[ ] T5.6  Wheel pickers show fade edges and a centre band
```

---

# §6 — DATABASE MIGRATIONS

**Task 6.a** — [ ] Write and run every migration below. **Do not write code that reads a column you have not migrated.**

| Table | Change | Default / backfill |
|---|---|---|
| `task_occurrences` | Add `'expired'` to status enum | — |
| `task_occurrences` | **Migrate all `'missed'` → `'expired'`** | — |
| `task_occurrences` | Remove `'missed'` from the enum | — |
| `task_occurrences` | `completedLate: boolean` | `false` |
| `members` | `freeRescueUsed: boolean` | `false` |
| `members` | `consecutiveMissedDays: int` | `0` |
| `members` | `streakEndedAt: timestamp?` | `null` |
| `members` | `streakEndedReason: enum?` | `null` |
| `households` | `timezone: string` | `'America/Toronto'`, then prompt admins |
| **new** | `xp_ledger_entries` | §1.6 |
| **new** | `streak_rescues` | §1.5 |
| **new** | `recess_periods` | §3.1 |
| **new** | `crown_awards` | §2.4 |
| **new** | `day_classifications` | §1.4 — cache `classifyDay` per member per day |
| **new** | `custom_house_rules` | §4.4 |

**Task 6.b** — [ ] Backfill `xp_ledger_entries` from existing completion history so the ledger is not empty on day one. Where the original award cannot be reconstructed, write a single opening `adjustment` entry per member labelled *"Starting balance"*.

**Task 6.c** — [ ] Run the full migration set against a **copy of production** before shipping. Report row counts changed per step.

---

# §7 — EVERY SCREEN THAT MUST EXIST WHEN YOU ARE DONE

Tick only what you have actually built and opened.

- [ ] Late-completed task card, showing `+7 XP` and `was 10`
- [ ] Expired task card, with **no** Complete button
- [ ] Streak Rescue screen, showing the absolute XP cost
- [ ] Streak Rescue screen, free-first-rescue variant
- [ ] Streak lost screen (cliff reached, no offer)
- [ ] XP ledger, grouped by day with a weekly total
- [ ] XP ledger empty state
- [ ] Leaderboard with gold / silver / bronze
- [ ] Leaderboard, tie state, with the `Tied for 1st` label
- [ ] Leaderboard, zero-XP state, no crown
- [ ] Leaderboard, member on Recess, greyed
- [ ] Champion's Record, own / admin view (all metrics)
- [ ] Champion's Record, sibling view (restricted metrics absent)
- [ ] Crown history on the member profile
- [ ] Settings → Recess, member list with toggles
- [ ] Recess banner on Home (admin view)
- [ ] Recess banner on Home (member's own view)
- [ ] Settings → House Rules, adult view
- [ ] House Rules, kid view — **one screen, no scroll**
- [ ] Custom house rules editor
- [ ] Settings → Notifications, per-category toggles

---

# §8 — DO NOT CHANGE ANY OF THESE

Regressions here are the most likely damage from this work.

- ❌ **Do not** gate XP behind parent approval. XP lands the instant the child taps Complete.
- ❌ **Do not** apply Late Credit to hygiene tasks. They are 0 XP by design.
- ❌ **Do not** let weekly, monthly or quarterly tasks break the daily streak.
- ❌ **Do not** recompute `awardedXp` after it is written. It is a snapshot.
- ❌ **Do not** generate task occurrences during Recess.
- ❌ **Do not** charge XP when a member ignores a Rescue offer.
- ❌ **Do not** show a member another member's late, expired, or rescue counts.
- ❌ **Do not** break the 100,000 XP trophy ceiling or the twelve trophy names.
- ❌ **Do not** reintroduce Fairness, Household Games, rooms, task priority, or the word "payroll".

---

# §9 — DECISION FLAGGED FOR THE PRODUCT OWNER

**The free first Streak Rescue (§1.5.f)** was recommended but not explicitly requested. It is implemented behind `FIRST_RESCUE_IS_FREE`. Confirm before shipping; removing it is a one-line change.

---

# §10 — COMPLETION REPORT

**Fill this in and include it in your final reply. A summary that does not follow this format is not accepted as complete.**

```
CHOREMAXX REVISION D — COMPLETION REPORT

PHASES
  Phase 1 Scoring engine ......... [ DONE / PARTIAL / NOT STARTED ]
  Phase 2 Crowns ................. [ DONE / PARTIAL / NOT STARTED ]
  Phase 3 Recess ................. [ DONE / PARTIAL / NOT STARTED ]
  Phase 4 House Rules ............ [ DONE / PARTIAL / NOT STARTED ]
  Phase 5 Notifications & polish . [ DONE / PARTIAL / NOT STARTED ]

TESTS
  Gate 1 (28 tests) .............. __ / 28 passing
  Gate 2 (10 tests) .............. __ / 10 passing
  Gate 3 (11 tests) .............. __ / 11 passing
  Gate 4 (8 tests)  .............. __ / 8  passing
  Gate 5 (6 tests)  .............. __ / 6  passing

  Any failing test, listed by ID with the reason:
  →

FAILURE MODES (§0.1) — confirm each
  F1 Old contradicting code DELETED, not commented ......... [ Y / N ]
  F2 Engine built and tested BEFORE any UI ................. [ Y / N ]
  F3 Zero hardcoded numbers outside constants files ........ [ Y / N ]
  F4 Every new field has a migration with a backfill ....... [ Y / N ]
  F5 All day-boundary math uses household.timezone ......... [ Y / N ]
  F6 Every screen in §7 built, including empty/edge states . [ Y / N ]
  F7 Test output pasted at every gate ...................... [ Y / N ]
  F8 Grep confirms zero retired terms remain ............... [ Y / N ]

GREP RESULTS — paste the count for each
  'missed'  (as an occurrence status) ...... __
  'vacation mode' .......................... __
  'redemption' ............................. __
  'late penalty' ........................... __
  0.15 / 0.30 / 0.50 in streak context ..... __
  Expected for all of the above: 0

MIGRATIONS
  Migrations written ....... __ / 15
  Run against prod copy .... [ Y / N ]
  Rows changed per step:
  →

SCREENS
  Built and opened ......... __ / 21
  Not built, and why:
  →

CONTRAST
  Gold hex ____  ratio ____
  Silver hex ____  ratio ____
  Bronze hex ____  ratio ____
  (all must be ≥ 4.5:1)

KID VIEW
  Fits one screen, no scroll ... [ Y / N ]
  Screenshot attached .......... [ Y / N ]

ANYTHING SKIPPED, DEFERRED, OR ASSUMED — be explicit:
  →

QUESTIONS THAT SHOULD HAVE BEEN ASKED:
  →
```

# ChoreMaxx — Trophy system (Part 2: Cursor implementation brief)

Implements the 100 trophies defined in `choremaxx-100-trophies-part1.md`. Read that file first — it is the source of truth for names, tiers and conditions. This document covers architecture, evaluation timing, and correctness.

Companion specs, both assumed already implemented:
- `choremaxx-reward-mode-cursor-spec-v3.md` — XP ladder, reward modes, hygiene exception
- `choremaxx-streak-engine-cursor-spec.md` — streaks, rollover job, household completion, XP ledger

---

## 1. Open decisions — I took these; confirm or overrule

| # | Question | Decision taken | Reversibility |
| --- | --- | --- | --- |
| 1 | Dynamic vs. fixed collection denominator | **Dynamic.** Trophies structurally unavailable to a household are excluded from the count and shown separately. | Config flag `TROPHY_DYNAMIC_DENOMINATOR`, default `true`. Flipping it to `false` gives a fixed /100. |
| 2 | "Nova's Favorite" | **Omitted.** I don't know what Nova is. The list stands at 100 without it. | Add as #101 or swap out any entry once defined. |
| 3 | "Homework Ace" | **Omitted.** Not universally obtainable — the Homework domain is `audience: 'family'`. | Same. |
| 4 | Hidden trophies | **Schema supports it**, `hidden: boolean`, default `false`. Six are marked hidden (§9). | One column edit per trophy. |
| 5 | Threshold for **Most Glorious** (#100) | **`availableTrophyCount - 1`**, not a hard 99. | See §8 — with a dynamic denominator, a hard 99 makes #100 impossible for most households. |

---

## 2. Discovery first — do not skip

Report on the following before writing code. Open the files; do not guess.

1. Is there an existing achievements/trophy implementation behind the screen in the mockup? Where does its data come from — hardcoded array, table, derived at render?
2. The completion write path — the function or mutation that records a completed task. This is where counters hook in.
3. The daily rollover job from the streak spec, and where per-child evaluation happens inside it.
4. The XP ledger, and how weekly gross is computed.
5. The household-completion (100%) code path and its celebration trigger.
6. Whether "rewards earned" is a recorded event with a timestamp, or merely a parent-configured setting with no event trail. **If there is no reward event, trophies 67–72 cannot be built** — report this rather than inventing an event model.
7. Whether habit/hygiene streaks are stored per-task-per-child with a length value.
8. Existing notification and modal/toast infrastructure.

Summarise all eight, then implement.

---

## 3. Architecture — the one thing to get right

**Definitions are data. Evaluators are code.**

There are 100 trophies but only **eight evaluator types**. Adding trophy #101 must be a new row in a seed table, not a new branch in a function. If you find yourself writing a `switch` with 100 cases, stop and re-read this section.

**Counters are maintained incrementally; trophies are thresholds against counters.** Never compute a trophy by scanning history. `tasksCompletedTotal >= 1000` reads one integer, not a `COUNT(*)` over ten thousand rows.

**Only re-evaluate trophies whose inputs changed.** Every definition declares the counter it depends on. Build a static index `Map<counterName, TrophyDefinition[]>` at boot. When `tasksMorning` increments, evaluate the four trophies that read it — not all 100.

---

## 4. Schema

```ts
export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type EvaluatorType =
  | 'counter_gte'        // counter >= threshold
  | 'max_value_gte'      // high-water mark >= threshold
  | 'set_size_gte'       // distinct-set cardinality >= threshold
  | 'bitmask_complete'   // all required bits set
  | 'boolean_flag'       // one-off event occurred
  | 'ratio_gte'          // share of a total >= threshold
  | 'consecutive_gte'    // consecutive periods >= threshold
  | 'composite_and';     // all sub-conditions true

export type Trigger =
  | 'on_completion'
  | 'on_daily_rollover'
  | 'on_week_close'
  | 'on_household_completion'
  | 'on_reward_earned'
  | 'on_trophy_award';

export type Obtainability =
  | 'always'
  | 'requires_rewards'         // household has rewards configured
  | 'requires_multi_member'    // 2+ children in household
  | 'requires_custom_tasks'    // household has created a custom task
  | 'requires_habits';         // household has assigned habit tasks

export interface TrophyDefinition {
  id: string;                  // stable slug — 'first-step', never renumber
  name: string;
  tier: Tier;
  category: string;            // 'volume' | 'xp' | 'streaks' | …
  description: string;         // shown in the UI, matches Part 1 wording
  iconKey: string;
  evaluator: EvaluatorType;
  counter: string;             // key into ChildStats
  threshold: number;
  params?: Record<string, unknown>;  // bitmask value, sub-conditions, ratio base
  trigger: Trigger;
  obtainability: Obtainability;
  hidden: boolean;
  sortOrder: number;
}

export interface AwardedTrophy {
  childId: string;
  trophyId: string;
  awardedAt: string;           // ISO, household-local aware
  backfilled: boolean;         // true if granted by the retroactive job (§10)
  seenAt: string | null;       // null until the child has viewed the celebration
}

export interface TrophyProgress {
  childId: string;
  trophyId: string;
  current: number;
  target: number;
  updatedAt: string;
}
```

**Constraints:**

- `UNIQUE (childId, trophyId)` on `AwardedTrophy`. This is the idempotency guarantee.
- `TrophyDefinition` is global reference data, seeded, cached in memory at boot. It is not per-household.
- `trophyId` is a stable slug. Never renumber, never reuse.

---

## 5. The counters

One `ChildStats` row per child, updated in the **same transaction** as the event that changes it. If the completion write succeeds and the counter update fails, trophies silently stop working — so they commit together or not at all.

```ts
interface ChildStats {
  childId: string;

  // volume & XP
  tasksCompletedTotal: number;
  xpTotal: number;
  xpDayMax: number;                    // high-water mark, single day

  // streaks
  longestStreak: number;
  streaks14Count: number;              // separate streaks that reached 14+
  postBreakStreakMax: number;          // longest streak begun after a break
  cleanStreakMax: number;              // longest streak with zero redemptions
  backOnHorseFlag: boolean;
  monthsNoBreak: number;

  // time of day (household-local at completion time)
  tasksMorning: number;                // 00:00–11:59
  tasksPreDawn: number;                // before 08:00
  tasksAfternoon: number;              // 12:00–17:59
  tasksEvening: number;                // 18:00–20:59
  firstBefore7amDays: number;
  fullCircleDays: number;
  tasksOnDueDay: number;

  // speed
  quickDrawFlag: boolean;
  sameDayCompletions: number;
  noonClearDays: number;
  speedrunFlag: boolean;
  weekClearedEarlyFlag: boolean;

  // perfection
  perfectDaysTotal: number;
  perfectDayStreakMax: number;
  perfectMondays: number;
  perfectWeekdayMask: number;          // 7 bits, Sun..Sat
  perfectWeekendFlag: boolean;

  // household
  householdContributions: number;
  firstOn100Days: number;
  anchorCount: number;                 // landed the final task of a 100% day
  weeks25Share: number;
  weeks40Share: number;
  weeksTopLeaderboard: number;
  allHandsDays: number;

  // rewards
  rewardsEarned: number;
  consecutiveWeeksWithReward: number;

  // variety
  domainsTouchedMask: number;          // 15 bits, one per domain
  distinctTasksCount: number;          // maintained via a companion set table
  customTasksCompleted: number;
  weeksWith10DistinctTasks: number;

  // habits
  habitStreakMax: number;
  habitsAt30PlusMax: number;
  allHabitsStreakMax: number;

  // longevity & calendar
  accountAgeDays: number;
  seasonsMask: number;                 // 4 bits
  jan1Flag: boolean;
  turnOfYearFlag: boolean;
  groundhogWeeks: number;
  monthsWithStreak: number;

  // meta
  trophiesUnlocked: number;
}
```

**Household-scoped counters** (`householdStreakLongest`) live on the household record and are read by definitions with a `scope: 'household'` marker. Every child in the household evaluates against the same value.

**Time-of-day bands are computed in household-local time** at the moment of completion, per the streak spec. Never UTC, never device time.

**`distinctTasksCount`** needs a companion `child_task_seen (childId, taskId)` table with a unique constraint. Increment the counter only on first insert.

---

## 6. Trigger mapping — all 100

| # | Trophy | Counter | Thr. | Evaluator | Trigger | Obtainability |
|---|---|---|---|---|---|---|
| 1 | First Step | tasksCompletedTotal | 1 | counter_gte | on_completion | always |
| 2 | Getting Started | tasksCompletedTotal | 10 | counter_gte | on_completion | always |
| 3 | Double Digits | tasksCompletedTotal | 25 | counter_gte | on_completion | always |
| 4 | Half Century | tasksCompletedTotal | 50 | counter_gte | on_completion | always |
| 5 | First Hundred | tasksCompletedTotal | 100 | counter_gte | on_completion | always |
| 6 | Quarter Master | tasksCompletedTotal | 250 | counter_gte | on_completion | always |
| 7 | Five Hundred | tasksCompletedTotal | 500 | counter_gte | on_completion | always |
| 8 | Four Figures | tasksCompletedTotal | 1000 | counter_gte | on_completion | always |
| 9 | The Long Haul | tasksCompletedTotal | 2500 | counter_gte | on_completion | always |
| 10 | Grand Total | tasksCompletedTotal | 10000 | counter_gte | on_completion | always |
| 11 | Point of Origin | xpTotal | 1 | counter_gte | on_completion | always |
| 12 | Rising Star | xpTotal | 500 | counter_gte | on_completion | always |
| 13 | Thousand Club | xpTotal | 1000 | counter_gte | on_completion | always |
| 14 | Ten Thousand | xpTotal | 10000 | counter_gte | on_completion | always |
| 15 | Fifty K | xpTotal | 50000 | counter_gte | on_completion | always |
| 16 | Six Figures | xpTotal | 100000 | counter_gte | on_completion | always |
| 17 | Banked | xpDayMax | 100 | max_value_gte | on_completion | always |
| 18 | Big Day Energy | xpDayMax | 250 | max_value_gte | on_completion | always |
| 19 | Week Warrior | longestStreak | 7 | max_value_gte | on_daily_rollover | always |
| 20 | Fortnight | longestStreak | 14 | max_value_gte | on_daily_rollover | always |
| 21 | Month Master | longestStreak | 30 | max_value_gte | on_daily_rollover | always |
| 22 | Season Ticket | longestStreak | 90 | max_value_gte | on_daily_rollover | always |
| 23 | Half Year Hero | longestStreak | 180 | max_value_gte | on_daily_rollover | always |
| 24 | Year One | longestStreak | 365 | max_value_gte | on_daily_rollover | always |
| 25 | Unbroken | longestStreak | 500 | max_value_gte | on_daily_rollover | always |
| 26 | Back on the Horse | backOnHorseFlag | 1 | boolean_flag | on_daily_rollover | always |
| 27 | Phoenix | postBreakStreakMax | 14 | max_value_gte | on_daily_rollover | always |
| 28 | Serial Streaker | streaks14Count | 3 | counter_gte | on_daily_rollover | always |
| 29 | No Restore Required | cleanStreakMax | 60 | max_value_gte | on_daily_rollover | always |
| 30 | Clean Slate | monthsNoBreak | 1 | counter_gte | on_daily_rollover | always |
| 31 | Early Bird | tasksMorning | 50 | counter_gte | on_completion | always |
| 32 | Dawn Patrol | tasksPreDawn | 25 | counter_gte | on_completion | always |
| 33 | Sunrise Shift | tasksMorning | 200 | counter_gte | on_completion | always |
| 34 | Sunset Expert | tasksAfternoon | 50 | counter_gte | on_completion | always |
| 35 | Golden Hour | tasksAfternoon | 200 | counter_gte | on_completion | always |
| 36 | Evening Edition | tasksEvening | 50 | counter_gte | on_completion | always |
| 37 | First Light | firstBefore7amDays | 10 | counter_gte | on_daily_rollover | always |
| 38 | Full Circle | fullCircleDays | 1 | counter_gte | on_daily_rollover | always |
| 39 | Sun Up, Sun Down | fullCircleDays | 10 | counter_gte | on_daily_rollover | always |
| 40 | Right on Time | tasksOnDueDay | 25 | counter_gte | on_completion | always |
| 41 | Quick Draw | quickDrawFlag | 1 | boolean_flag | on_completion | always |
| 42 | Same Day Service | sameDayCompletions | 25 | counter_gte | on_completion | always |
| 43 | No Procrastination | sameDayCompletions | 100 | counter_gte | on_completion | always |
| 44 | Noon Clear | noonClearDays | 1 | counter_gte | on_daily_rollover | always |
| 45 | Speedrun | speedrunFlag | 1 | boolean_flag | on_completion | always |
| 46 | Ahead of the Curve | weekClearedEarlyFlag | 1 | boolean_flag | on_completion | always |
| 47 | Clean Sweep | perfectDaysTotal | 1 | counter_gte | on_daily_rollover | always |
| 48 | Ten Out of Ten | perfectDaysTotal | 10 | counter_gte | on_daily_rollover | always |
| 49 | Perfect Week | perfectDayStreakMax | 7 | max_value_gte | on_daily_rollover | always |
| 50 | Flawless Fortnight | perfectDayStreakMax | 14 | max_value_gte | on_daily_rollover | always |
| 51 | Immaculate Month | perfectDayStreakMax | 30 | max_value_gte | on_daily_rollover | always |
| 52 | Spotless | perfectDayStreakMax | 90 | max_value_gte | on_daily_rollover | always |
| 53 | Century of Perfection | perfectDaysTotal | 100 | counter_gte | on_daily_rollover | always |
| 54 | Weekend Warrior | perfectWeekendFlag | 1 | boolean_flag | on_daily_rollover | always |
| 55 | Monday Motivation | perfectMondays | 10 | counter_gte | on_daily_rollover | always |
| 56 | Full House | perfectWeekdayMask | 127 | bitmask_complete | on_daily_rollover | always |
| 57 | Team Player | householdContributions | 1 | counter_gte | on_household_completion | always |
| 58 | Domino | firstOn100Days | 1 | counter_gte | on_household_completion | always |
| 59 | The Anchor | anchorCount | 10 | counter_gte | on_household_completion | always |
| 60 | The Closer | anchorCount | 50 | counter_gte | on_household_completion | always |
| 61 | Pulling Weight | weeks25Share | 1 | counter_gte | on_week_close | requires_multi_member |
| 62 | The Carry | weeks40Share | 1 | counter_gte | on_week_close | requires_multi_member |
| 63 | Household Hero | weeksTopLeaderboard | 1 | counter_gte | on_week_close | requires_multi_member |
| 64 | All Hands | allHandsDays | 10 | counter_gte | on_daily_rollover | requires_multi_member |
| 65 | Dynasty Trophy | householdStreakLongest | 30 | max_value_gte | on_daily_rollover | always |
| 66 | Home Advantage | householdStreakLongest | 100 | max_value_gte | on_daily_rollover | always |
| 67 | First Payday | rewardsEarned | 1 | counter_gte | on_reward_earned | requires_rewards |
| 68 | Ten Reward Salute | rewardsEarned | 10 | counter_gte | on_reward_earned | requires_rewards |
| 69 | Fifty and Counting | rewardsEarned | 50 | counter_gte | on_reward_earned | requires_rewards |
| 70 | Reward Centurion | rewardsEarned | 100 | counter_gte | on_reward_earned | requires_rewards |
| 71 | Well Earned | consecutiveWeeksWithReward | 4 | consecutive_gte | on_week_close | requires_rewards |
| 72 | Standing Order | consecutiveWeeksWithReward | 13 | consecutive_gte | on_week_close | requires_rewards |
| 73 | Jack of All Trades | domainsTouchedMask | 5 | set_size_gte | on_completion | always |
| 74 | Renaissance | domainsTouchedMask | 10 | set_size_gte | on_completion | always |
| 75 | Cartographer | domainsTouchedMask | — | composite_and | on_completion | always |
| 76 | Range | weeksWith10DistinctTasks | 1 | counter_gte | on_week_close | always |
| 77 | Fifty Flavours | distinctTasksCount | 50 | counter_gte | on_completion | always |
| 78 | Completionist's Eye | distinctTasksCount | 100 | counter_gte | on_completion | always |
| 79 | Custom Made | customTasksCompleted | 1 | counter_gte | on_completion | requires_custom_tasks |
| 80 | Freestyle | customTasksCompleted | 25 | counter_gte | on_completion | requires_custom_tasks |
| 81 | Fresh Start | habitStreakMax | 7 | max_value_gte | on_daily_rollover | requires_habits |
| 82 | Routine | habitStreakMax | 30 | max_value_gte | on_daily_rollover | requires_habits |
| 83 | Second Nature | habitStreakMax | 100 | max_value_gte | on_daily_rollover | requires_habits |
| 84 | Muscle Memory | habitStreakMax | 365 | max_value_gte | on_daily_rollover | requires_habits |
| 85 | Locked In | habitsAt30PlusMax | 3 | max_value_gte | on_daily_rollover | requires_habits |
| 86 | Whole Package | allHabitsStreakMax | 14 | max_value_gte | on_daily_rollover | requires_habits |
| 87 | One Month In | accountAgeDays | 30 | counter_gte | on_daily_rollover | always |
| 88 | Anniversary | accountAgeDays | 365 | counter_gte | on_daily_rollover | always |
| 89 | Veteran | accountAgeDays | 730 | counter_gte | on_daily_rollover | always |
| 90 | Four Seasons | seasonsMask | 15 | bitmask_complete | on_completion | always |
| 91 | New Year, New Me | jan1Flag | 1 | boolean_flag | on_completion | always |
| 92 | Turn of the Year | turnOfYearFlag | 1 | boolean_flag | on_daily_rollover | always |
| 93 | Groundhog Week | groundhogWeeks | 4 | consecutive_gte | on_week_close | always |
| 94 | Eternal Laurel | — | — | composite_and | on_daily_rollover | always |
| 95 | Decorated | trophiesUnlocked | 10 | counter_gte | on_trophy_award | always |
| 96 | Trophy Case | trophiesUnlocked | 25 | counter_gte | on_trophy_award | always |
| 97 | Immortal Badge | trophiesUnlocked | 50 | counter_gte | on_trophy_award | always |
| 98 | Ascendant Cup | trophiesUnlocked | 75 | counter_gte | on_trophy_award | always |
| 99 | Sovereign Crown | trophiesUnlocked | 90 | counter_gte | on_trophy_award | always |
| 100 | Most Glorious | trophiesUnlocked | dynamic | counter_gte | on_trophy_award | always |

**Composite definitions:**

- **#75 Cartographer** — `popcount(domainsTouchedMask) >= popcount(householdAvailableDomainsMask)`. Compares against what the household actually has, not a hard 15.
- **#94 Eternal Laurel** — `accountAgeDays >= 1095 AND monthsWithStreak >= monthsActive`. Three years with a streak in every month.
- **#100 Most Glorious** — threshold is `availableTrophyCount - 1`, resolved per household at evaluation time. See §8.

---

## 7. The evaluation engine

```ts
// Built once at boot from the seeded definitions.
const BY_COUNTER: Map<string, TrophyDefinition[]> = indexDefinitions();

async function evaluate(childId: string, changedCounters: string[], tx: Transaction) {
  const candidates = dedupe(changedCounters.flatMap(c => BY_COUNTER.get(c) ?? []));
  const stats = await loadStats(childId, tx);
  const alreadyHeld = await loadAwardedIds(childId, tx);

  const newlyAwarded: string[] = [];

  for (const def of candidates) {
    if (alreadyHeld.has(def.id)) continue;
    if (!isObtainable(def, household)) continue;
    if (!meetsCriterion(def, stats)) {
      await upsertProgress(childId, def, stats, tx);
      continue;
    }
    const inserted = await insertAward(childId, def.id, tx); // ON CONFLICT DO NOTHING
    if (inserted) newlyAwarded.push(def.id);
  }

  if (newlyAwarded.length > 0) {
    await incrementCounter(childId, 'trophiesUnlocked', newlyAwarded.length, tx);
    await enqueueCelebrations(childId, newlyAwarded, tx);
    // cascade — collection trophies read trophiesUnlocked
    await evaluate(childId, ['trophiesUnlocked'], tx, depth + 1);
  }
}
```

**Non-negotiables:**

1. **Awarding is idempotent.** `INSERT … ON CONFLICT DO NOTHING` against the unique constraint. Concurrent evaluation must never produce two awards.
2. **Trophies are never revoked.** If a parent rejects a completion and `tasksCompletedTotal` decrements below a threshold, the trophy **stays**. Counters move both ways; awards only move up. Taking a trophy back from a child is a support nightmare and reads as a bug even when it's correct.
3. **Cascade is bounded.** Awarding a trophy increments `trophiesUnlocked`, which can award a collection trophy, which increments again. Cap recursion at depth 5, log and stop if exceeded.
4. **Evaluation runs inside the triggering transaction.** A completion and its trophy award commit together.
5. **Never scan history.** Every evaluator reads `ChildStats` fields. If an evaluator needs a query over completions, the counter is missing — add the counter.
6. **Cache definitions in memory.** They're static reference data. Do not query them per completion.

---

## 8. Obtainability and the collection percentage

```ts
function isObtainable(def: TrophyDefinition, hh: Household): boolean {
  switch (def.obtainability) {
    case 'always':               return true;
    case 'requires_rewards':     return hh.hasRewardsConfigured;
    case 'requires_multi_member':return hh.childCount >= 2;
    case 'requires_custom_tasks':return hh.hasCustomTasks;
    case 'requires_habits':      return hh.hasAssignedHabits;
  }
}
```

**Collection progress:**

```ts
const available = DEFINITIONS.filter(d => isObtainable(d, household));
const earned = awarded.length;
const pct = Math.floor((earned / available.length) * 100);
```

Display as `earned / available.length` — e.g. **"12 / 94"**, not "12 / 100".

**Locked trophies get their own UI section**, below the grid: *"Not available in your household (6)"*, each with a one-line reason — *"Requires rewards to be turned on"*, *"Requires two or more children"*. Two reasons for this: it's honest, and it's actionable. A parent who turns rewards on sees six trophies appear, which is a better conversion prompt than any upsell.

**Obtainability is dynamic.** A household that adds a second child unlocks four trophies mid-life. When `isObtainable` flips from false to true, run a targeted re-evaluation for those definitions — the child may already qualify.

**Why #100 needs a dynamic threshold.** With a fixed threshold of 99, any household missing even one structurally-unavailable trophy can never earn Most Glorious. Set it to `availableTrophyCount - 1` so the capstone is reachable for every configuration. This does mean a smaller household reaches it sooner; that's the correct trade.

---

## 9. Hidden trophies

`hidden: true` renders a locked slot with a silhouette icon and the label **"???"**, no name and no description, until awarded. Progress is tracked silently.

Marked hidden: **Domino** (58), **Quick Draw** (41), **Speedrun** (45), **New Year, New Me** (91), **Turn of the Year** (92), **Back on the Horse** (26).

Hidden trophies **count** toward the denominator and toward collection trophies. Only their identity is concealed.

---

## 10. Retroactive unlocks — existing users

A one-time backfill job. Every current user must receive the trophies they already qualify for.

1. Compute `ChildStats` from scratch for every existing child, from completion history and the XP ledger. This is the only place a full history scan is permitted.
2. Run evaluation with all counters marked changed.
3. Insert awards with `backfilled: true`.
4. **Do not enqueue individual celebrations.** A returning user must not be hit with 15 stacked modals.
5. Instead queue one summary screen shown on next launch: *"Welcome back — you've unlocked 15 trophies"*, with the grid and a single dismiss.

The job must be idempotent and resumable — checkpoint per child, safe to re-run.

**Counters that can't be reconstructed.** Some depend on data you may not have historically: `quickDrawFlag` needs assignment timestamps; `firstBefore7amDays` needs per-completion times. If the data isn't there, leave the counter at zero and let those trophies accrue going forward. **Report which counters you could not backfill** rather than fabricating values.

---

## 11. Celebration and notification

**Scale the celebration to the tier.** A full-screen takeover for every Bronze trophy trains users to dismiss without looking.

| Tier | Presentation |
| --- | --- |
| Bronze | Toast, 3s, auto-dismiss |
| Silver | Card slide-up, tap to dismiss |
| Gold | Modal with the icon and description |
| Platinum | Full-screen takeover with animation |

**Rules:**

- **Queue, never stack.** Multiple trophies at once show sequentially, or — better — one combined screen: *"3 trophies unlocked"*. Never two modals at the same time.
- **Never interrupt the household-completion celebration.** That one has priority; queue trophy celebrations behind it.
- **Respect `prefers-reduced-motion`** — static states, no confetti.
- **`seenAt`** is set on view. Unseen trophies show a badge on the Achievements tab.

**Parent notifications:** Gold and Platinum only, batched into at most one per day. Bronze and Silver are too frequent to be worth a push and will get notifications muted entirely.

> **[Child] unlocked Immaculate Month**
> 30 perfect days in a row. That's a Gold trophy.

---

## 12. Progress display

For every unearned, obtainable trophy, show progress: **`47 / 50`** with a thin bar. This is most of the motivational value of the system — a locked grid with no numbers tells a child nothing about what's close.

Boolean and composite trophies show no bar, just locked state.

On the Achievements screen, surface the three closest-to-completion trophies at the top as **"Almost there"**.

---

## 13. Tests

**Awarding**
1. Crossing a threshold awards exactly once
2. Re-running evaluation does not award a second time
3. Concurrent evaluations produce one award (unique constraint holds)
4. A counter decrementing below a threshold does **not** revoke an awarded trophy
5. An unobtainable trophy is never awarded even when the criterion is met

**Evaluators**
6. `counter_gte`, `max_value_gte`, `set_size_gte`, `bitmask_complete`, `boolean_flag`, `ratio_gte`, `consecutive_gte` each pass at, and fail just below, their threshold
7. `bitmask_complete` for Full House requires all 7 bits; 6 bits fails
8. Cartographer compares against the household's available domains, not a hard 15

**Cascade**
9. Awarding the 10th trophy awards Decorated in the same transaction
10. Cascade terminates; depth never exceeds 5
11. Most Glorious resolves against `availableTrophyCount - 1`

**Triggers**
12. Time-of-day counters use household-local time, not UTC — assert across a timezone boundary
13. A task completed at 11:59am counts as morning; 12:01pm as afternoon
14. Rollover-triggered trophies are not evaluated on completion, and vice versa
15. Week-close trophies evaluate once per week, not once per day

**Obtainability**
16. Denominator excludes unobtainable trophies
17. Turning rewards on increases the denominator by 6 and triggers re-evaluation
18. Adding a second child unlocks the multi-member trophies and re-evaluates

**Backfill**
19. Backfill is idempotent — re-running awards nothing new
20. Backfilled awards set `backfilled: true` and enqueue no individual celebrations
21. Backfill produces one summary screen regardless of count

**Performance**
22. A single task completion evaluates fewer than 15 definitions, not 100
23. No evaluator issues a query against the completions table

---

## 14. Do not

- Do not write a 100-case switch — definitions are data, evaluators are code
- Do not recompute trophies by scanning completion history outside the backfill job
- Do not evaluate all 100 definitions on every event
- Do not revoke an awarded trophy under any circumstance
- Do not fire individual celebrations during backfill
- Do not stack modals
- Do not use UTC or device time for any time-of-day or calendar condition
- Do not renumber or reuse a `trophyId` slug
- Do not add trophies that reward activity after 21:00 — it contradicts the app's own bedtime tasks
- Do not add trophies that reward redeeming a streak — it incentivises breaking them
- Do not collect dates of birth to support calendar trophies

---

## 15. Build order

1. Schema, seed the 100 definitions, `ChildStats` table
2. Counter increments wired into the completion path, inside the existing transaction
3. The eight evaluators plus the counter index
4. `evaluate()` with idempotent awarding and bounded cascade
5. Obtainability and the dynamic denominator
6. Achievements UI — grid, progress bars, locked section, "Almost there"
7. Celebration queue and tier presentation
8. Parent notifications
9. Backfill job, run last, in staging first

Ship 1–4 and verify awarding is correct before building any UI. A trophy system that double-awards or silently misses is worse than no trophy system, and the bugs are invisible until a user complains.

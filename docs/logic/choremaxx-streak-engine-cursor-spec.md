# ChoreMaxx — Streak engine, XP redemption & household completion

Implementation brief for Cursor. This governs daily rollover, streaks, the redemption penalty ladder, the household completion bar, and the notifications attached to all of it.

Read §1 and §2 before writing any code. §1 lists decisions I made where your instructions were ambiguous — if any is wrong, correcting it changes the logic downstream, so confirm before building.

Companion specs: `choremaxx-reward-mode-cursor-spec-v3.md` (reward modes, XP ladder, hygiene exception). Everything here assumes that document is already implemented, in particular the `awardedXp` snapshot rule and the hygiene/streak separation.

---

## 1. Decisions taken on ambiguous rules — confirm these first

| # | Ambiguity | Decision taken | Why |
| --- | --- | --- | --- |
| 1 | Does a no-task day *extend* the streak or merely *preserve* it? | **Preserve, not extend.** A day with zero due tasks keeps the streak alive at its current value. It does not increment it. | Otherwise a child with no assignments for a fortnight gains a 14-day streak for doing nothing, and the number stops meaning anything. |
| 2 | Are penalties additive or tiered? | **Tiered replacement.** 1 redemption in a week = 15% total. 2 = 30% total. 3+ = 50% total. Not 15+30+50. | Matches your wording ("two days missed → 30% of the XP that week is gone") and keeps 50% a true ceiling. |
| 3 | Percentage of *what*, exactly? | **Gross XP earned in that calendar week**, applied as a single deduction **at week close**. | See §6. Charging at redemption time is exploitable — a child who breaks a streak on Monday morning with 0 XP banked would redeem for free. |
| 4 | How long can a broken streak be redeemed? | **Until end-of-day on the following day.** After that the break is final. | An unbounded window makes the streak meaningless — you could restore a streak broken in March, in June. |
| 5 | Who initiates redemption? | **The child**, self-serve. Parent is notified after. A household setting `redemptionRequiresApproval` (default **false**) can require parent sign-off. | Your wording ("*you* can regain it back") reads as child-initiated. The setting exists for parents who want control. |
| 6 | Do missed *hygiene* tasks break the daily streak? | **No.** Hygiene tasks carry their own per-task streaks and are entirely independent of the daily chore streak. | Consistent with the hygiene exception in the v3 spec. A child shouldn't lose a chore streak over flossing. |
| 7 | Is the streak per-child or per-household? | **Per-child.** The household completion bar is the household-level mechanic. | Two separate concepts; conflating them makes both unreadable. |
| 8 | Does late parent *approval* break a streak? | **No.** Streaks evaluate on the child's completion timestamp, not the parent's approval timestamp. | A child who did the work at 6pm shouldn't lose a streak because a parent approved it Tuesday. |
| 9 | Does a break without redemption cost XP? | **No.** Not redeeming is free; the streak simply resets to 0. XP is only the price of restoration. | The mechanic is a trade, not a fine. |
| 10 | Does the penalty rate track *breaks* or *redemptions*? | **Redemptions only.** Break, don't redeem, break again, redeem → that's redemption #1, rate 15%. | You pay for what you buy. |

---

## 2. Foundations you must establish first

Nothing below works without these. Build them before the streak logic.

**Household timezone.** Every household has an IANA timezone (`America/Toronto`). All day boundaries, week boundaries and rollover jobs compute in household-local time, never in UTC and never in device-local time. A family travelling must not gain or lose a streak day.

**End-of-day cutoff.** Household setting `dayEndsAt`, default `00:00` (true midnight). A task completed at 23:59 counts for that day; 00:01 counts for the next. If you allow configuring this later (e.g. 2am for teens), the whole engine must already read the setting rather than assuming midnight.

**Week start.** Household setting `weekStartsOn`, default Monday. The penalty ladder and weekly XP totals are scoped to this week.

**DST.** Days are 23 or 25 hours twice a year. Compute day boundaries with a real timezone library (`date-fns-tz`, `Luxon`, `Temporal`) on local calendar dates. Never `Date.now() - 86400000`.

**The `localDate` key.** Every daily record is keyed by `(householdId | childId, localDate)` where `localDate` is a `YYYY-MM-DD` string in household time. This key is what makes the rollover job idempotent.

---

## 3. Data model

```ts
type StreakState = 'active' | 'broken_redeemable' | 'broken_final';

interface ChildDay {
  childId: string;
  localDate: string;          // 'YYYY-MM-DD', household-local
  tasksDue: number;           // chores due this day (hygiene excluded)
  tasksCompleted: number;
  outcome: 'complete' | 'partial' | 'missed' | 'neutral' | null; // null = not yet rolled over
  evaluatedAt: string | null;
}

interface ChildStreak {
  childId: string;
  current: number;
  longest: number;
  state: StreakState;
  lastActiveDate: string | null;   // last date that counted toward the streak
  brokenOnDate: string | null;
  redeemableUntil: string | null;  // localDate — end of the day after the break
}

interface WeeklyPenalty {
  childId: string;
  weekKey: string;            // 'YYYY-Www', household-local, respects weekStartsOn
  redemptionCount: number;    // 0,1,2,3+
  penaltyRate: number;        // 0 | 0.15 | 0.30 | 0.50 — derived, stored for audit
  appliedAt: string | null;   // set at week close; null while week is open
  grossXpAtApply: number | null;
  deductedXp: number | null;
}

interface HouseholdDay {
  householdId: string;
  localDate: string;
  tasksDue: number;           // across all members
  tasksCompleted: number;
  completedAt: string | null; // when it first hit 100% — null if never
  celebrationFiredAt: string | null;
}
```

**XP is a ledger, not a mutable balance.**

```ts
interface XpLedgerEntry {
  id: string;
  childId: string;
  weekKey: string;
  type: 'award' | 'streak_penalty' | 'adjustment';
  amount: number;             // signed — penalties are negative
  sourceId: string | null;    // completion id, redemption id
  occurredAt: string;
}
```

A child's weekly XP is `SUM(amount)` over that week. The penalty is a **negative ledger entry**, never a mutation of `awardedXp` on past completions. This preserves the history-immutability rule from the v3 spec and makes every deduction auditable when a parent asks why the number dropped.

---

## 4. Daily outcome classification

At rollover, each child-day resolves to exactly one outcome:

| Outcome | Condition | Effect on streak |
| --- | --- | --- |
| `neutral` | `tasksDue === 0` | **Preserved, not incremented.** `current` unchanged, `lastActiveDate` unchanged. |
| `complete` | `tasksDue > 0` and `tasksCompleted === tasksDue` | `current += 1`, `lastActiveDate = localDate` |
| `partial` | `tasksDue > 0` and `0 < tasksCompleted < tasksDue` | **Break.** Treated identically to `missed`. |
| `missed` | `tasksDue > 0` and `tasksCompleted === 0` | **Break.** |

Note that `partial` breaks the streak. "All tasks for the day" means all of them. If you want a partial-credit rule, that's a product decision to make deliberately, not a default — flag it rather than implementing it.

Hygiene tasks (`xpEligible: false`) are excluded from `tasksDue` and `tasksCompleted` entirely.

---

## 5. Streak state machine

```
                  complete / neutral
                 ┌──────────────┐
                 ▼              │
            ┌─────────┐         │
   ─────────► ACTIVE  ├─────────┘
            └────┬────┘
                 │ partial / missed
                 ▼
        ┌──────────────────┐   redeem    ┌────────┐
        │ BROKEN_REDEEMABLE├────────────► ACTIVE │  (current restored)
        └────────┬─────────┘             └────────┘
                 │ redemption window expires
                 ▼
          ┌──────────────┐
          │ BROKEN_FINAL │  → current = 0, state returns to ACTIVE next day
          └──────────────┘
```

On break:

1. Set `state = 'broken_redeemable'`, `brokenOnDate = <the missed date>`, `redeemableUntil = <next localDate>`.
2. **Do not zero `current` yet.** Hold the pre-break value so redemption can restore it exactly.
3. Notify the parent (§8).

On redemption (§6): restore `current` to its held value, increment the week's `redemptionCount`, set `state = 'active'`.

On window expiry (rollover job for the day after `brokenOnDate`): set `current = 0`, `state = 'broken_final'`, clear the held value. From the next day the child accrues normally from 0.

Update `longest` whenever `current` exceeds it. Never decrease `longest`.

---

## 6. The redemption penalty ladder

**The rate.**

```ts
export function penaltyRateFor(redemptionCount: number): number {
  if (redemptionCount <= 0) return 0;
  if (redemptionCount === 1) return 0.15;
  if (redemptionCount === 2) return 0.30;
  return 0.50; // 3 or more — hard ceiling
}

export const MAX_PENALTY_RATE = 0.50;
```

Assert `penaltyRateFor(n) <= MAX_PENALTY_RATE` for all n. 50% is the maximum a child can lose in a week, no matter how many redemptions.

**When it's charged.** Not at redemption. At **week close**, in the rollover job for the last day of the week:

```ts
const gross = sumLedger(childId, weekKey, { type: 'award' }); // positive awards only
const rate  = penaltyRateFor(redemptionCount);
const deducted = Math.round(gross * rate);

if (deducted > 0) {
  writeLedgerEntry({
    childId, weekKey,
    type: 'streak_penalty',
    amount: -deducted,
    occurredAt: weekCloseTimestamp,
  });
}
```

**Why deferred and not immediate.** If the penalty is charged the moment the child redeems, a child who breaks a streak on Monday morning — before earning anything — pays 15% of zero. The exploit is to break early in the week every week and redeem for free. Deferring to week close and charging against the week's *gross* awards closes it. There's no way to redeem cheaply by timing.

**Consequences to implement correctly:**

- The deduction is computed against **gross awards**, not the running net. Applying 30% to an already-reduced balance would double-discount.
- One penalty entry per child per week. Not one per redemption. Re-running the job must not write a second entry — enforce with a unique constraint on `(childId, weekKey, type='streak_penalty')`.
- If `gross` is 0 at week close, `deducted` is 0. A child who earned nothing pays nothing. Accepted: there's nothing to take, and they've already lost the week.
- Net weekly XP can never go below 0. With a max rate of 0.5 it can't anyway, but assert it.
- `Math.round`, not floor or ceil. Document it so parents' arithmetic matches the app's.

**Worked example — confirm this matches your intent:**

> Week starts Monday. Rate ladder applies per calendar week.
>
> | Day | Gross XP | Event |
> | --- | --- | --- |
> | Mon | 40 | complete |
> | Tue | 0 | missed → break → **redeemed** (redemption #1) |
> | Wed | 50 | complete |
> | Thu | 45 | complete |
> | Fri | 0 | missed → break → **redeemed** (redemption #2) |
> | Sat | 60 | complete |
> | Sun | 35 | complete |
>
> Gross = 230. Redemptions = 2 → rate 30%. Deduction = `round(230 × 0.30)` = **69**. Net = **161**.
>
> Streak survives the whole week and continues into next week. The penalty counter resets Monday.

**Live display while the week is open.** The child and parent must see the pending cost, or the deferred charge feels like an ambush. Show a projected deduction on the child's weekly card that updates as XP accrues:

> ⚠️ **Streak redeemed ×2 — 30% of this week's XP**
> Projected: 230 XP earned · −69 at week's end · **161 net**

Label it clearly as projected, since it moves as they earn more.

**Redemption eligibility gate.** Before offering redemption, check:

- `state === 'broken_redeemable'`
- current localDate ≤ `redeemableUntil`
- if `redemptionRequiresApproval`, a parent has approved

If `redemptionCount` is already ≥ 3, redemption is still offered — the rate is already at the 50% ceiling, so further redemptions in that week are effectively free. **Flag this to the product owner** (§11); it's a live consequence of "50% is the maximum" and you may not want it.

---

## 7. Household completion

`HouseholdDay.tasksDue` is the sum of all chores due that day across every member. `tasksCompleted` is the sum completed.

**Percentage:**

```ts
const pct = day.tasksDue === 0 ? null : Math.floor((day.tasksCompleted / day.tasksDue) * 100);
```

`null`, not `0` and not `100`, when nothing is due. Guard the division. A day with no assigned tasks shows an empty/rest state — **never** a 100% celebration.

**Firing the celebration.** The moment `tasksCompleted === tasksDue && tasksDue > 0`, fire immediately. Do not wait for midnight. The celebration is the reward for the last task and must land while the family is still awake and in the room.

**Idempotency — the thing most likely to break.**

- Guard on `celebrationFiredAt === null`. Set it in the same transaction as the check.
- Unique constraint on `(householdId, localDate)` for the celebration record.
- If a completion is later **undone** (child un-checks, parent rejects), recalculate the bar downward — but **do not clear `celebrationFiredAt`**. If they re-complete, the celebration must not fire twice. Once per household per day, absolutely.
- Concurrency: two children completing their last task simultaneously must produce one celebration. Use a transaction with a conditional update, not a read-then-write.

**The celebration itself.** Full-screen takeover:

> ## 🎉 CONGRATULATIONS
> ### HOUSE COMPLETION 100%
> Every task done today. [N]-day house streak.

- Respect `prefers-reduced-motion` — replace confetti/animation with a static state.
- Dismissible by tap and by keyboard.
- Do not block a critical flow. If a parent is mid-task-assignment, queue it rather than interrupting.
- Push a notification to every household member who wasn't the one who triggered it, so absent parents see it too.

**Household streak.** Consecutive days where the household hit 100%. Follows the same neutral-day rule: a day with `tasksDue === 0` preserves but does not increment. Household streaks have **no redemption mechanic** — that's an individual thing. Confirm if you disagree.

---

## 8. Notifications

Three triggers.

| Trigger | Recipients | Timing |
| --- | --- | --- |
| Streak broken | All parents in the household | Queued at rollover, delivered at `notificationHour` |
| Streak redeemed | All parents in the household | Immediate |
| House completion 100% | All members except the triggering user | Immediate |

**Streak broken** — queued, not immediate. Rollover runs at midnight; a push at 12:01am is hostile. Queue and deliver at household setting `notificationHour`, default **08:00** local.

> **[Child] missed their streak**
> [Child] didn't finish yesterday's tasks, so their [N]-day streak ended. They can restore it today by trading 15% of this week's XP.

The percentage in that message must be `penaltyRateFor(redemptionCount + 1)` — the cost of the *next* redemption, not the current rate. If they've already redeemed once this week, it says 30%.

**Streak redeemed** — immediate, and must state the cost:

> **[Child] restored their streak**
> [Child] traded 15% of this week's XP to keep their [N]-day streak alive. That's about [X] XP at their current pace.

Second redemption:

> [Child] traded 30% of this week's XP — their second restore this week — to keep their [N]-day streak alive.

Third and beyond:

> [Child] traded 50% of this week's XP — the maximum — to keep their [N]-day streak alive. Their weekly rewards will be affected.

The XP estimate is projected from gross-so-far and must be labelled approximate, since the week isn't closed.

**Batching.** One notification per parent per trigger type per day, maximum. Three children breaking streaks on the same night produces **one** notification listing all three, not three pushes:

> **3 streaks ended last night**
> [A], [B] and [C] didn't finish yesterday's tasks. Each can restore today.

**Suppression.** If a child breaks and redeems before the broken-streak notification is delivered, **cancel the queued break notification** and send only the redemption one. Do not send both — it reads as two separate events.

**Respect existing preferences.** Wire into whatever notification-preference mechanism already exists; if none does, report that in discovery and do not invent one here.

---

## 9. The rollover job

One scheduled job, running hourly, processing every household whose local `dayEndsAt` has just passed. Hourly rather than once daily because households span timezones.

For each household:

1. Compute the closing `localDate`.
2. **Idempotency check** — if a `ChildDay` for `(childId, localDate)` already has `evaluatedAt`, skip it. Never re-evaluate.
3. Classify each child's day (§4).
4. Apply streak transitions (§5).
5. Expire any redemption window whose `redeemableUntil` has passed.
6. Finalise `HouseholdDay` and the household streak.
7. If the closing date is the last day of the household's week, apply the weekly penalty (§6) and reset `redemptionCount` for the new week.
8. Queue notifications.

**Requirements:**

- **Fully idempotent.** Re-running for the same date is a no-op. This is not optional — jobs get retried.
- **Backfillable.** If the server is down for two days, the job must process missed dates **in chronological order** on recovery. Streak transitions are order-dependent; processing Wednesday before Tuesday produces wrong results.
- **Never skip a date.** A gap in `ChildDay` records is a silent streak corruption. Assert continuity.
- **Isolated failures.** One household erroring must not abort the batch. Log, continue, alert.
- Log a per-household summary — days evaluated, streaks broken, penalties applied — so a bad run is visible immediately.

---

## 10. Tests

**Neutral days**

1. `tasksDue: 0` → outcome `neutral`, `current` unchanged, streak not broken
2. Seven consecutive neutral days → `current` unchanged (not +7) — decision #1
3. Neutral day between two complete days → streak continues across it

**Breaks**

4. `tasksDue: 3, tasksCompleted: 3` → `complete`, `current += 1`
5. `tasksDue: 3, tasksCompleted: 2` → `partial` → break
6. `tasksDue: 3, tasksCompleted: 0` → `missed` → break
7. On break, `current` is **held**, not zeroed
8. Redemption window expires → `current = 0`
9. Missed hygiene task does not break the daily streak — decision #6
10. Task completed at 23:59 counts for that day; 00:01 for the next
11. Late parent approval of an on-time completion does not break the streak — decision #8

**Penalty ladder**

12. `penaltyRateFor(0..4)` → 0, 0.15, 0.30, 0.50, 0.50
13. Gross 230, 2 redemptions → deduction 69, net 161 (the §6 worked example)
14. Penalty computed on gross awards, not on net — no double-discounting
15. Break without redemption → no penalty entry — decision #9
16. Break, no redeem, break, redeem → `redemptionCount === 1`, rate 15% — decision #10
17. Redeem with gross 0 at week close → deduction 0
18. Re-running week close writes **one** penalty entry, not two
19. `redemptionCount` resets at week start
20. Net weekly XP never negative
21. A redemption in week 1 does not affect week 2's rate

**Household completion**

22. `tasksDue: 0` → pct is `null`; no celebration
23. Last task completed → celebration fires immediately, not at midnight
24. Un-complete then re-complete → celebration fires **once**
25. Two simultaneous final completions → one celebration
26. `celebrationFiredAt` survives a downward recalculation
27. Household streak follows the neutral-day rule

**Rollover**

28. Job re-run for the same date is a no-op
29. Two-day outage → both dates processed in chronological order
30. DST spring-forward and fall-back days classify correctly
31. One household throwing does not abort the batch

**Notifications**

32. Break notification queued, delivered at `notificationHour`, not at rollover
33. Break notification quotes the cost of the *next* redemption
34. Redeem before delivery → break notification cancelled, only redemption sent
35. Three children breaking → one batched notification per parent
36. Redemption notification states the correct tier (15/30/50)

---

## 11. For the product owner — not for Cursor to act on

**The 50% ceiling makes late-week redemptions free.** Once a child has redeemed three times in a week, the rate is pinned at 50% and every further redemption that week costs literally nothing. A child who breaks Monday, Tuesday and Wednesday can then miss Thursday, Friday, Saturday and Sunday and restore all of them at no additional cost — finishing the week with an unbroken streak and only the 50% they'd already committed to. That's the opposite of the incentive you want, and a motivated 11-year-old will find it inside a month.

Three ways out, in ascending order of harshness:

1. **Cap redemptions per week at 3.** The 4th break is final regardless of willingness to pay. Simplest, and preserves 50% as a genuine ceiling.
2. **Cap the streak-restore benefit** — after the 3rd redemption, restoration returns the streak to a reduced value rather than the full held value.
3. **Let the rate exceed 50%** — contradicts your stated maximum, so probably not.

I'd take option 1. It keeps your "50% maximum" promise exactly as stated while removing the free ride.

**Deferred charging is the right model but needs to be visible.** Charging at week close is the only way to prevent the redeem-at-zero exploit, but it means a child agrees to a cost they can't yet see. The projected-deduction display in §6 isn't cosmetic — without it, Sunday night will feel like a bug report rather than a consequence. Make sure it survives design review.

**Partial completion is a harsh default.** As specified, completing 4 of 5 tasks breaks the streak exactly as hard as completing 0. That's defensible and simple, but it's the rule most likely to generate "the app is unfair" feedback, since the child *did* the work. Worth considering whether `partial` at a high threshold (say ≥80%) should preserve rather than break. I've implemented the strict version because that's what you described — flag it if you want the softer rule.

**The redemption mechanic sits oddly next to your reward modes.** In Equity mode, the household has explicitly chosen that effort shouldn't determine points — and then the streak system reintroduces a steep effort-based penalty through the back door. Not a contradiction exactly, but a family that picked Equity for a specific reason may be surprised. Consider whether `hygieneRewarded`-style opt-out is warranted for redemption too, or at minimum that the onboarding copy mentions the streak economy exists.

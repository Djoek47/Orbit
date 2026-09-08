# ChoreMaxx — Reward mode + task library XP system (v3)

Implementation brief for Cursor. Read §1 before anything else, then read the whole document before writing code.

Companion file: `choremaxx_tasks.csv` (150 rows). It is the source of truth for XP values. Do not invent XP numbers.

---

## 1. THE ONE RULE THAT MUST NOT BE GOT WRONG

**Hygiene tasks are worth 0 XP. In Meritocracy. In Equity. In both. Always, unless a parent explicitly turns them on.**

19 of the 150 library rows carry `tracking: 'streak'`, `xp: 0`, `xp_eligible: false`. All 19 are personal hygiene: brushing teeth, flossing, showering, washing hair, deodorant, clean underwear, clipping nails, washing hands, taking vitamins or medication.

These tasks sit **outside** the reward system entirely. They are tracked as streaks — consecutive days completed — and that is all. They are:

- worth **0 XP under Meritocracy**
- worth **0 XP under Equity** — Equity's flat 10 XP does **not** apply to them
- excluded from every leaderboard, running total, and XP summary
- marked in the UI with a visible symbol so a child can see they're measured differently (§6)
- switchable on by a parent, off by default (§5)

The reward mode is a choice between two ways of scoring *chores*. Hygiene is not a chore. The mode does not reach it.

**The most likely way to get this wrong** is writing the resolver as `mode === 'flat' ? 10 : baseXp` and treating eligibility as an afterthought. That single line makes a child earn points for washing their hands and lets a sibling out-rank them on personal hygiene. The eligibility check comes **first**, before any mode branch, in every code path. §7 gives the exact function.

---

## 2. Discovery first — do not skip

Before making changes, locate and report on the following. Open the files; do not guess at names.

1. The onboarding flow container — the component rendering the existing reward-selection step (XP / rewards / allowance). Path, how it tracks the current step, how it advances.
2. The type or enum for that existing reward selection.
3. Where onboarding answers are persisted (local state, context, store, server mutation, DB table).
4. The task/chore model — where XP lives, and whether it's on the task definition, the assignment, or the completion.
5. Whether the 150-task library is already seeded, and in what shape.
6. Whether any streak-tracking mechanic already exists, and if so, how streaks are stored and broken.
7. The settings screen and how a single settings row is built.
8. Whether there is a household/family entity that settings hang off, or whether settings are per-parent-user.

Summarise all eight findings in a short list, then implement. If any contradicts an assumption below, stop and say so rather than working around it.

---

## 3. What we're building

**A.** A canonical task library seeded from `choremaxx_tasks.csv`.

**B.** A new onboarding step, immediately after the existing reward-type step:

> **What reward system would you like to put in place?**

**Meritocracy** — default, pre-selected. Harder and longer tasks are worth more. Mow the lawn 30 XP · Take out the trash 10 XP · Feed the pet 5 XP.

**Equity** — every chore is worth the same 10 XP, regardless of effort. Mow the lawn 10 XP · Take out the trash 10 XP · Feed the pet 10 XP.

Both cards carry the same footnote: *Hygiene tasks are tracked as streaks, not points.\**

**C.** The streak-marker system (§6) that makes the exception visible everywhere hygiene tasks appear.

**D.** A parent setting to opt hygiene into points, off by default (§5).

---

## 4. Naming and enums

Neutral internal identifiers, not user-facing labels:

```ts
export type RewardMode = 'weighted' | 'flat';
```

`weighted` = Meritocracy. `flat` = Equity. The labels are likely to change (see §16); persisting them as enum values would turn a copy edit into a data migration. Keep display strings in one place:

```ts
export const REWARD_MODE_COPY: Record<RewardMode, { label: string; blurb: string }> = {
  weighted: { label: 'Meritocracy', blurb: 'Harder, longer tasks are worth more points.' },
  flat:     { label: 'Equity',      blurb: 'Every chore is worth the same, no matter the effort.' },
};

export const STREAK_FOOTNOTE = 'Hygiene tasks are tracked as streaks, not points.';
```

---

## 5. Household settings

Three fields on the **household**, not the user. If two parents each hold their own values, the leaderboard means nothing.

```ts
interface HouseholdRewardSettings {
  rewardMode: RewardMode;      // NOT NULL, default 'weighted'
  hygieneRewarded: boolean;    // NOT NULL, default false
  hygieneXp: number;           // NOT NULL, default 5 — only read when hygieneRewarded
}
```

Behaviour of `hygieneRewarded`:

- **Default false.** Out of the box, and for every existing household on migration, hygiene earns nothing.
- When **false**: hygiene tasks award 0 XP, are absent from leaderboards and XP totals, and show the streak marker.
- When **true**: each completed hygiene task awards `hygieneXp` — **the same value in both reward modes**. Meritocracy does not apply the ladder to hygiene; there are no per-task hygiene XP values in the library and none should be invented. Streak tracking continues unchanged, and the marker stays visible because the task is still scored differently from a chore.
- `hygieneXp` is chosen from the two lowest ladder rungs only: **5** (default) or **10**. Not a free number field. Hygiene must never be worth more than a real chore.

Settings UI, grouped with the other reward settings, parent-only, enforced server-side:

- Row: **Reward system** → Meritocracy / Equity
- Row: **Reward hygiene tasks** → toggle, default off, with helper text: *Off by default. Hygiene is tracked as a streak so kids build the habit without earning points for it.*
- When the toggle is on, reveal a second row: **Points per hygiene task** → 5 or 10.

Turning the toggle **on** confirms:

> **Reward hygiene tasks?**
> Brushing teeth, showering and similar tasks will start earning 5 XP each and will count on the leaderboard. Streaks keep working either way.
>
> [Cancel] [Turn on]

Turning it **off** confirms:

> **Stop rewarding hygiene tasks?**
> These tasks go back to streaks only. Points already earned won't change.
>
> [Cancel] [Turn off]

---

## 6. The streak marker — making the exception visible

A hygiene task must be visually distinguishable from a chore **everywhere it appears**: task library browser, search results, assignment sheet, child's task list, task detail, completion confirmation, and any weekly summary.

Build exactly one component and use it in every one of those places. Do not re-implement the marker inline anywhere.

```tsx
// StreakMarker.tsx — the single source of the hygiene affordance
export function StreakMarker({ variant }: { variant: 'asterisk' | 'badge' }) { … }
```

**`variant="asterisk"`** — for dense rows where a chore would show "10 XP". Render a superscript asterisk in the XP slot instead of a number, in muted secondary colour, never in the XP accent colour.

```
Take out the trash          10 XP
Brush your teeth (bedtime)    ✳
```

**`variant="badge"`** — for cards and detail views. A small pill reading **Streak** with a flame icon, in a neutral or distinct colour — never the amber/XP colour, or it reads as points.

Accessibility, non-negotiable:

- The asterisk must never be the only signal. Include visually-hidden text: `<span class="sr-only">Tracked as a streak, not points</span>`.
- Do not rely on colour alone.
- The badge needs an accessible name, not just an icon.

**The legend.** Any screen listing both chores and hygiene tasks together renders `STREAK_FOOTNOTE` once at the bottom of the list, keyed to the asterisk. One footnote per screen, not per row.

**When `hygieneRewarded` is true**, the marker stays — the task is still measured differently — but the row shows the value alongside it, and the footnote changes:

```
Brush your teeth (bedtime)   5 XP ✳
```

> *Hygiene tasks are tracked as streaks and earn a flat 5 XP.*

Keep both footnote strings next to `STREAK_FOOTNOTE` so they can't drift apart.

---

## 7. XP resolution — the core logic

**Rule 1 — Never mutate `baseXp`.** Each task keeps its intrinsic ladder value permanently. Switching to Equity must not overwrite it, or switching back would collapse all 131 chores to 10 XP forever.

**Rule 2 — Resolve at read time, through one function, eligibility guard first.**

```ts
export const FLAT_TASK_XP = 10;

export interface XpContext {
  mode: RewardMode;
  hygieneRewarded: boolean;
  hygieneXp: number;
}

export function resolveTaskXp(
  task: Pick<LibraryTask, 'baseXp' | 'xpEligible'>,
  ctx: XpContext,
): number {
  // Hygiene / streak tasks: outside the reward system in BOTH modes.
  // This branch runs first and never falls through to the mode logic.
  if (!task.xpEligible) {
    return ctx.hygieneRewarded ? ctx.hygieneXp : 0;
  }

  // Chores only, from here down.
  return ctx.mode === 'flat' ? FLAT_TASK_XP : task.baseXp;
}
```

Read that shape carefully: `ctx.mode` is **never referenced** inside the `!task.xpEligible` branch. That is deliberate and is the whole point of §1. If you find yourself writing `mode` anywhere above the final return, you have reintroduced the bug.

Every place that reads a task's XP for display or assignment routes through this function — task library, search, assignment sheet, child task list, task detail, completion flow, weekly summary, any preview component. Find them all and report the list.

**Rule 3 — Snapshot XP at completion.** When a chore is approved, write the resolved value onto the completion record as `awardedXp`. Leaderboards, running totals and history read `awardedXp`, never a recomputed value.

Without this, a parent switching modes in week three retroactively rewrites every past score — the kid who mowed the lawn last Saturday for 30 XP wakes up with 10, and the leaderboard reshuffles overnight. Same applies to toggling `hygieneRewarded`: flipping it on must not retroactively award points for last month's showers.

**Rule 4 — Mode and hygiene-toggle changes are forward-only.** They affect completions after the change. Nothing historical moves.

**Rule 5 — Streaks are independent of XP.** Streak tracking runs for every `tracking: 'streak'` task regardless of `hygieneRewarded`, `rewardMode`, or anything else. Turning on hygiene points adds XP; it does not change streak behaviour. Turning it off removes future XP; it does not break a streak.

---

## 8. The task library data model

Mirror the CSV columns exactly. Every field is load-bearing.

```ts
export type Tracking = 'xp' | 'streak';
export type Audience = 'both' | 'family';
export type Frequency =
  | 'daily' | 'weekdays' | '2x_weekly' | 'weekly'
  | 'biweekly' | 'monthly' | 'quarterly' | 'seasonal' | 'as_needed';

export interface LibraryTask {
  taskId: string;         // T001–T150, stable, never reassign
  domain: string;         // 15 top-level areas
  group: string;          // 43 groups
  task: string;           // display name
  baseXp: number;         // intrinsic Meritocracy value, 0–30
  tracking: Tracking;     // 'xp' = chore, 'streak' = hygiene
  xpEligible: boolean;    // false for all 19 streak tasks
  frequency: Frequency;
  frequencyLabel: string; // pre-rendered, e.g. "2× / week"
  timesPerYear: number;   // planning/forecast views only
  aliases: string[];      // semicolon-delimited in CSV — split on ';'
  audience: Audience;     // 'both' = families + roommates, 'family' = kids only
}
```

Importer notes:

- The CSV is UTF-8 with a BOM and CRLF line endings. Strip both.
- `aliases` is semicolon-delimited and contains French terms (`poubelle`, `devoirs`, `épicerie`, `déneiger`) and British/AU variants (`hoover`, `tyres`, `kerb`, `skirting boards`, `rubbish`). Index all of them for search.
- Four rows contain commas inside quoted fields (`"Meals, Groceries & Errands"`, `"Put away remotes, chargers & cables"`). Use a real CSV parser, never `split(',')`.
- `task_id` is the stable key referenced by assignments and completion history. Never renumber.
- All 19 streak tasks are `audience: 'family'` — they must not surface in roommate/shared-household mode at all.

---

## 9. The Meritocracy XP ladder

XP is a **six-stop ladder**, not a free numeric field. All 131 chores sit on one of six rungs, encoding time-on-task first and unpleasantness/skill second.

| XP | Time | Character | Representative tasks |
| --- | --- | --- | --- |
| **5** | under 5 min | Trivial, no skill | Make the bed · Set the table · Feed the pet · Bring in the mail |
| **10** | 5–15 min | Light, routine | Load the dishwasher · Take out the garbage · Wipe the counters · Read for 20 minutes |
| **15** | 15–30 min | Sustained or mildly unpleasant | Fold the laundry · Vacuum the bedroom · Walk the dog · Scoop the litter box |
| **20** | 30–45 min | Unpleasant, or requires focus | Clean the toilet · Mop the floors · Do your homework · Help cook dinner |
| **25** | 45–60 min | Heavy, sustained effort | Scrub the shower · Clean out the fridge · Go grocery shopping · Wash the car |
| **30** | 60+ min | Physically hard, often outdoors | Mow the lawn · Rake the leaves · Shovel the snow · Clean out the garage |

```ts
export const XP_LADDER = [5, 10, 15, 20, 25, 30] as const;
export type XpRung = (typeof XP_LADDER)[number];
```

Distribution: 5 ×35 · 10 ×43 · 15 ×26 · 20 ×12 · 25 ×11 · 30 ×4. Median 10, mean 12.4. `FLAT_TASK_XP = 10` is the median, so Equity is close to XP-neutral in aggregate.

Custom tasks created by a parent must pick from the six rungs, presented as labelled choices ("Under 5 minutes — 5 XP" … "Over an hour — 30 XP"). No free number input. The ladder only stays meaningful if custom tasks live on it.

---

## 10. Seeding

Idempotent seed script, upserting by `taskId`.

Validate before writing, and fail loudly:

- exactly 150 rows
- exactly 131 with `tracking: 'xp'`, exactly 19 with `tracking: 'streak'`
- every `tracking: 'xp'` row has `baseXp` on the ladder and `xpEligible: true`
- every `tracking: 'streak'` row has `baseXp === 0` and `xpEligible: false`
- every `taskId` unique and matching `/^T\d{3}$/`

Log a per-domain count on completion so a bad import is obvious. The library is global reference data; custom tasks live in a separate household-scoped table with the same shape.

---

## 11. The onboarding screen

Match the existing onboarding steps' layout, spacing, back-button behaviour and progress indicator. Reuse the previous step's card/radio component. Do not invent a new visual language for one screen.

- **Heading:** What reward system would you like to put in place?
- **Two selectable cards**, stacked on mobile, each with label, one-line blurb, and a three-row worked example rendered as compact rows (not a `<table>`):

  | Meritocracy | Equity |
  | --- | --- |
  | Mow the lawn — 30 XP | Mow the lawn — 10 XP |
  | Take out the trash — 10 XP | Take out the trash — 10 XP |
  | Feed the pet — 5 XP | Feed the pet — 10 XP |

  The example sells the distinction; two abstract labels alone produce arbitrary taps.

- **Beneath both cards**, once, not per card: `✳ ` + `STREAK_FOOTNOTE` + a quiet trailing line: *You can change this in Settings.*
- **Meritocracy pre-selected on mount.** Primary button enabled immediately; the user can advance without touching anything.
- Primary button copy matches the rest of the flow (likely "Continue" — check).

Accessibility: real radio inputs, or `role="radio"` inside a `role="radiogroup"` with an `aria-label` matching the question. Keyboard operable, visible focus, whole card is the tap target, back-navigation preserves the selection.

---

## 12. Tests

Chore resolution:

1. `resolveTaskXp({ baseXp: 30, xpEligible: true }, { mode: 'weighted', … })` → 30
2. same task, `mode: 'flat'` → 10
3. `{ baseXp: 5, xpEligible: true }`, `mode: 'flat'` → 10

Hygiene resolution — the §1 guard. Assert all four explicitly:

4. `{ baseXp: 0, xpEligible: false }`, `mode: 'weighted'`, `hygieneRewarded: false` → **0**
5. `{ baseXp: 0, xpEligible: false }`, `mode: 'flat'`, `hygieneRewarded: false` → **0** ← the Equity-flattening bug
6. `{ baseXp: 0, xpEligible: false }`, `mode: 'weighted'`, `hygieneRewarded: true, hygieneXp: 5` → 5
7. `{ baseXp: 0, xpEligible: false }`, `mode: 'flat'`, `hygieneRewarded: true, hygieneXp: 5` → 5 — **identical to test 6**; hygiene XP is mode-independent

Persistence and history:

8. Completing a chore under `weighted` stores `awardedXp: 30`; switching to `flat` afterwards leaves that record at 30
9. Completing the same chore after the switch stores `awardedXp: 10`
10. Toggling `hygieneRewarded` on does not retroactively award XP for past hygiene completions
11. A household with no `rewardMode` resolves as `weighted`; with no `hygieneRewarded` resolves as `false`

Behaviour and access:

12. With `hygieneRewarded: false`, no streak task contributes to any leaderboard total, in either mode
13. Streak tracking is unaffected by `rewardMode`, `hygieneRewarded`, and by toggling either
14. `hygieneXp` rejects any value other than 5 or 10
15. A child account cannot mutate `rewardMode`, `hygieneRewarded`, or `hygieneXp` (assert the server guard, not hidden UI)
16. `audience: 'family'` tasks are hidden in roommate/shared-household mode
17. Seed validation: 150 rows, 131 chores, 19 streak, ladder conformance

UI:

18. Every surface listing a hygiene task renders `StreakMarker`
19. The marker's visually-hidden text is present and non-empty
20. Screens mixing chores and hygiene render the footnote exactly once

---

## 13. Acceptance criteria

- [ ] All 150 tasks seeded with correct domain, group, XP, tracking, frequency, aliases, audience
- [ ] Seed is idempotent and validates ladder + streak conformance
- [ ] Alias search matches French and British variants
- [ ] **Hygiene tasks award 0 XP under Meritocracy and 0 XP under Equity, by default**
- [ ] **`resolveTaskXp` never reads `mode` inside the ineligible branch**
- [ ] Hygiene tasks never reach a leaderboard while `hygieneRewarded` is false
- [ ] `StreakMarker` appears on hygiene tasks in every listed surface, with visually-hidden text
- [ ] Footnote renders once per mixed screen, and in onboarding beneath both cards
- [ ] Parent can enable hygiene rewards; default off; value restricted to 5 or 10; same value in both modes
- [ ] Both toggle directions show a confirmation dialog
- [ ] Streak tracking unaffected by every reward setting
- [ ] New onboarding step directly after the existing reward-type step, correct progress and back behaviour
- [ ] Meritocracy pre-selected; continuing without interaction persists `weighted`
- [ ] All XP displays route through `resolveTaskXp`
- [ ] `awardedXp` snapshotted at completion; history immune to setting changes
- [ ] Settings rows parent-gated server-side
- [ ] Custom tasks offer the six ladder rungs, not a free number field
- [ ] Keyboard and screen-reader operable throughout
- [ ] No existing household's behaviour changes

---

## 14. Do not

- **Do not apply `FLAT_TASK_XP` to any task with `xpEligible: false`** — this is the failure mode this document exists to prevent
- **Do not reference `mode` inside the ineligible branch of the resolver**
- Do not give hygiene tasks per-task XP values under Meritocracy — there are none in the library, and inventing them recreates the ladder inside a system that is supposed to sit outside it
- Do not let `hygieneXp` exceed 10
- Do not overwrite `baseXp` when Equity is selected
- Do not recompute historical scores when any setting changes
- Do not allow off-ladder XP values, including on custom tasks
- Do not re-implement the streak marker inline — one component, used everywhere
- Do not use colour alone to signal the exception
- Do not renumber or reassign `task_id`
- Do not use `split(',')` on the CSV
- Do not add a third reward mode, per-child overrides, or a free-form XP editor — out of scope
- Do not put any of the three settings on the user record
- Do not create a new design system for the onboarding screen

---

## 15. Summary table — pin this

| Task type | Meritocracy | Equity | Marker | Streak tracked |
| --- | --- | --- | --- | --- |
| Chore (`xpEligible: true`) | ladder value, 5–30 | flat 10 | none | no |
| Hygiene, rewards **off** (default) | **0** | **0** | ✳ Streak | yes |
| Hygiene, rewards **on** | `hygieneXp` (5 or 10) | `hygieneXp` — same value | ✳ Streak | yes |

The middle row is the default state and the one that matters. The reward mode column has the same value in it either way, on purpose.

---

## 16. For the product owner — not for Cursor to act on

**The frequency problem is bigger than the mode problem.** Meritocracy weights tasks correctly in isolation, but the leaderboard totals occurrences, and frequency swamps difficulty:

| Task | XP | Times/yr | Annual XP |
| --- | --- | --- | --- |
| Scoop the litter box | 15 | 365 | **5,475** |
| Walk the dog | 15 | 365 | **5,475** |
| Do your homework | 20 | 260 | **5,200** |
| Mow the lawn | 30 | 52 | **1,560** |
| Shovel the snow | 30 | 8 | 240 |
| Clean out the garage | 30 | 4 | 120 |

The hardest task in the library yields under a third of what scooping a litter box yields. A child assigned three daily 5-XP tasks beats a sibling who mows the lawn weekly, decisively. Meritocracy at the task level does not survive contact with the leaderboard.

This doesn't block the feature, but it's what will generate the "this is unfair" arguments the app exists to prevent. Options: normalise the leaderboard per assigned load, score on percentage-of-assigned-completed rather than raw XP, or — cheapest and my suggestion — show parents a weekly XP-per-child forecast at assignment time, turning an invisible imbalance into a visible one they can fix before it becomes a fight.

**On the hygiene opt-in.** Keeping it off by default is the right call and worth holding to. There's a well-documented effect where paying for a behaviour someone already does willingly can reduce their intrinsic motivation to do it — and hygiene is exactly the category where you want the habit to become self-sustaining rather than transactional. Offering the toggle respects that some households have a genuine reason to use it (a child who needs concrete reinforcement to build a routine), but the default should stay off and the helper text should say why. Consider whether the setting deserves a one-line explanation in-product rather than being a bare switch.

**On the labels.** "Meritocracy" and "Equity" are politically loaded terms in North America right now, in an app parents install for their children. You'll draw one-star reviews about the wording from both directions. The mechanic is good; the vocabulary is what's exposed. Neutral alternatives:

- **Effort-based** / **Equal points**
- **Weighted** / **Flat**
- **Harder tasks earn more** / **Every task earns the same**

The third is clearest to a parent skimming onboarding and needs no blurb. Keeping Meritocracy and Equity as deliberate brand voice is defensible — ChoreMaxx already leans into internet register — but make it a decision rather than a default. Because §4 keeps the enum neutral, you can ship either set now and swap later without touching the database.

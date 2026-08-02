# ChoreMaxx v2 — Implementation Specification for Cursor

**Revision B.** All seven open questions from Revision A are now resolved and folded into the body (Section 13 records them). The real task library is attached as `choremaxx-task-library.json` — 150 tasks, 15 domains, 43 groups.

**Companion specs — read both, this document assumes them:**
- `choremaxx-reward-mode-cursor-spec-v3.md` — reward modes, XP ladder, hygiene/streak separation
- The streak-engine spec — daily rollover, streak breaks, the 15/30/50% XP redemption ladder, household completion celebration

Where this document and a companion conflict, **this document wins for UI and flow**; the companions win for streak and XP-penalty arithmetic.

**Status:** Authoritative. This document supersedes prior behaviour wherever the two conflict.
**Scope:** Onboarding, household creation, task assignment, reward system, recurrence engine, and a set of targeted UI corrections.
**Author intent:** The app must feel *user-friendly, classy, and effortless*. Simplicity and elegance are the acceptance criteria, not just the mood. Where a decision is ambiguous, choose the option that removes a tap, removes a screen, or removes a choice.

---

## 0. How to work through this document

1. Read Sections 1–3 fully before writing code. They change the app's core data model and information architecture; doing the cosmetic fixes first will create rework.
2. Implement in the order given: **Global renames → Data model → Onboarding flow → Task picker → Reward engine → Recurrence engine → Screen fixes → QA.**
3. Every section ends with **Acceptance criteria**. Do not mark a section done until all of its criteria pass on a fresh install *and* on an upgrade from an existing install.
4. Section 13 lists items that require a decision from the product owner. Do not invent answers to those — implement the stated default, add a `// TODO(product):` comment, and surface the question in your summary.

### Design principles (apply to every screen you touch)

- **One decision per screen.** If a screen asks two unrelated questions, split it or defer one.
- **No decorative emoji.** Emoji are banned from the reward pages entirely (Section 6). Elsewhere, prefer a consistent icon set (SF Symbols / Lucide) over emoji glyphs. Emoji render inconsistently and read as cheap.
- **Progressive disclosure.** 150 tasks must never be visible at once. Show 14 domain tiles or a search field; reveal depth only on demand.
- **Contrast floor.** All body and label text must meet WCAG AA (4.5:1) against its background. Several current screens fail this (Section 9.6).
- **Reversibility.** Every multi-step flow needs a working Back that preserves entered state. Nothing in setup should be a one-way door.
- **No dead ends.** Every screen that can be reached must have a visible way forward and a visible way back.

---

## 1. Global renames and removals

### 1.1 Rename the AI assistant: Nova → Poppins

Replace **every** occurrence of `Nova` with `Poppins`, across:

- All UI strings, including the bottom tab bar label, the "Open Nova" button on Home, empty states, tooltips, onboarding copy, notification copy, and push notification titles.
- Component names, file names, route names, and identifiers: `NovaTab` → `PoppinsTab`, `useNova` → `usePoppins`, `nova-panel.tsx` → `poppins-panel.tsx`, `/nova` → `/poppins`, etc.
- Analytics event names and properties (`nova_opened` → `poppins_opened`). Keep a mapping note in the PR description so historical analytics can be stitched.
- System prompts, assistant persona strings, and any hardcoded self-introduction ("I'm Nova" → "I'm Poppins").
- App Store metadata, marketing copy, and the support/marketing pages if they mention Nova.

Run a case-insensitive repo-wide search for `nova` afterward and confirm zero remaining matches other than unrelated third-party dependencies. Report any you intentionally skipped.

**Tone note:** "Poppins" invites a warm, capable, slightly formal household-assistant voice. Update the assistant's persona copy accordingly — helpful and composed, never cutesy, never using emoji.

### 1.2 Remove roommates — ChoreMaxx is a family app

Delete the roommate concept from the product, not just from the UI:

- Remove the **Household type** selector entirely (`Family / Single parent / Roommates / Multi-gen / Custom`). There is no household type anymore; every household is a family.
- Delete the `householdType` field from the data model, or hard-code it to `family` and stop reading it. Prefer deletion with a migration.
- Remove roommate-specific copy, illustrations, onboarding branches, and any "roommate" strings in marketing/App Store text.
- Member roles reduce to **Admin** and **Member**. See Section 1.6 for the confirmed permission matrix.
- Any splitting/fairness logic that existed to serve roommate use cases is removed or repurposed — see Section 9.4.

### 1.3 Remove "Rooms" as a categorisation system

Rooms are replaced entirely by the **15 domains** of the task library (Section 4).

- Remove the Rooms picker from household setup.
- Remove the `ROOM (OPTIONAL)` field from the Custom task sheet.
- Remove room chips/badges from task cards in the task list.
- Remove `room` from the task model. Migrate existing tasks by mapping their room to the closest domain (Section 11.2), and drop the column.

### 1.4 Remove the word "Payroll"

On the Rewards Center → Allowance tab, `This Week's Payroll` becomes **`This Week's Allowance`**. These are children, not employees. Audit for related employment metaphors and soften them:

- `Payroll` → `Allowance`
- `Pay Now` → **`Send Allowance`**
- `Open items` → **`Unpaid`** (or `Awaiting`)
- `Approved` and `Pending` are fine as-is.
- `+ Bonus` is fine as-is.

### 1.5 Remove Household Games

Delete the "Household Games" card from the Ranks/Achievements page, including the route, component, and the "coming soon" copy. It references drinking games, which is off-brand for a family product and is an App Review risk.

### 1.6 Permission model — Admin vs Member (confirmed)

Two roles. Enforce **server-side**, not by hiding buttons — a hidden button is not a permission.

| Action | Admin | Member |
|---|:---:|:---:|
| Assign or edit a task | ✅ | ❌ |
| Approve a completion | ✅ | ❌ |
| Request additional proof | ✅ | ❌ |
| Send allowance / mark paid | ✅ | ❌ |
| Grant or revoke a reward | ✅ | ❌ |
| Create or edit rewards | ✅ | ❌ |
| Change reward model / scoring mode | ✅ | ❌ |
| Add or remove members | ✅ | ❌ |
| Mark **their own** task complete | ✅ | ✅ |
| Submit photo proof | ✅ | ✅ |
| View their own tasks, XP, streak, rewards | ✅ | ✅ |
| View the household leaderboard | ✅ | ✅ |

- A member **cannot approve their own completion**, and an admin **cannot approve their own** either when the task requires proof — otherwise the proof requirement is theatre. Where the household has exactly one admin, their own proof-required tasks auto-approve, with a `// TODO(product)` note; single-admin households have no second approver by definition.
- Members never see admin affordances at all. Do not render a disabled `Approve` button on a child's screen — it teaches them the app has doors they can't open.
- The first member created during onboarding is the admin. Additional admins can be promoted from Settings → Household.

### 1.7 Completion, notification, and the proof loop (new)

**The governing rule: XP is awarded the moment the child taps Complete.** Not on parent approval. Approval is a *verification layer that runs after the fact*, never a gate in front of the reward.

```
Child taps Complete  →  status: completed
                        XP awarded IMMEDIATELY
                        streak credited IMMEDIATELY
                        verification: 'unreviewed'
                                ↓
                     Parent notified right away
                                ↓
        ┌───────────────┬───────────────┬───────────────┐
        ↓               ↓               ↓               ↓
   (does nothing)   Confirm      Ask for another    Mark not done
        ↓               ↓            photo               ↓
   auto-confirms   verified:      verified:         XP REVERSED
   after 72h       'confirmed'    'proof_requested'  status → pending
   XP unchanged    XP unchanged   XP unchanged       streak recalculated
```

This is a meaningfully better design than approval-gating, and it removes an entire class of bug: a child's reward can no longer be delayed, reduced, or lost because a parent was asleep, at work, or simply didn't open the app. The child's loop is instant and honest. The parent's loop is oversight, and it runs on the parent's own schedule.

**It also dissolves the late-completion timing problem entirely.** With XP awarded on tap, `completedAt` is the only timestamp that matters — there is no `approvedAt` to reconcile against a deadline, and no way for slow parent approval to break a child's streak. Delete any logic that reads approval time for lateness or streak purposes.

**Model:** verification is a **separate field from status**, not a status value. Conflating them is what created the gating problem in the first place.

```ts
interface TaskOccurrence {
  status: 'pending' | 'late' | 'completed' | 'missed';
  completedAt?: string;
  awardedXp: number;

  verification: 'not_required' | 'unreviewed' | 'confirmed'
              | 'proof_requested' | 'rejected';
  proofPhotoUrls: string[];       // one per round
  proofRounds: ProofRound[];      // note + timestamp per request
  verifiedBy?: string;
  verifiedAt?: string;
}
```

- `verification` starts as `not_required`, or `unreviewed` when `requiresPhoto` is true.
- **`status: 'completed'` is set on tap regardless of verification state.** Nothing about verification blocks it.
- `unreviewed` auto-transitions to `confirmed` after **72 hours** with no parent action. Most completions will never be reviewed, and they should not accumulate as a guilt-inducing backlog.

**Parent notification (on tap):** *"{Name} completed 'Wipe down kitchen counters' · +10 XP"* with the photo thumbnail if one was attached, and inline `Confirm` / `Ask for another photo` actions directly in the notification. A parent should be able to verify from the lock screen without opening the app.

**Request additional proof:**
- Labelled **`Ask for another photo`** — not "Reject". The point is a second look, not a verdict.
- Opens a small sheet with an optional one-line note: *"Can you get the corner of the counter in the shot?"* Send.
- `verification` moves to `proof_requested`. The child is notified and the task surfaces at the top of their list with the note visible and a `Add another photo` action.
- **XP is not touched.** The task remains `completed`, the streak is untouched, the child keeps what they earned. This is verification, not clawback.
- Re-submission appends a photo and returns `verification` to `unreviewed`.
- **Cap at 3 rounds**, then the parent must Confirm or Mark not done. An uncapped loop is a way for a bad night between a parent and a teenager to live inside your app.

**Mark not done (the reversal path):**
- This is the only action that touches XP, and it exists because awarding on tap means a child *could* mark something complete without doing it. Verification is what makes that self-correcting.
- Sets `verification: 'rejected'`, **reverses the awarded XP**, and returns `status` to `pending` — or to `late`/`missed` if the deadline has since passed, evaluated against the clock at reversal time.
- Recalculate the streak from that day forward. If the reversal causes a day to fall below completion, apply the streak break and the redemption ladder exactly as the streak-engine companion spec defines. Do not invent parallel logic.
- The child is notified with the parent's note. Copy is neutral: *"Mum marked 'Clean the toilet' as not done yet."* Never "rejected", never "failed".
- **Reversal is available for 7 days after completion**, then locked. Nobody should be able to claw back XP from three weeks ago; the ledger has to settle.
- Log every reversal. A household where reversals are frequent is a signal worth surfacing to the parent later.

**Timing rules:**
- Lateness is stamped once, from `completedAt` vs `dueAt`. Verification never affects it.
- A proof round never resets or re-stamps lateness.
- A completed-but-unreviewed occurrence is **never** turned into `missed` by rollover. It is complete.

**Admin surface:** an **Approvals** section on Home, visible to admins only, showing a count badge and the pending items with photo thumbnails. Batch-approve should be available — a parent with three kids should not tap through nine screens on a Sunday night.

**Acceptance criteria — Section 1**
- A member account cannot assign, approve, request proof, or send allowance — verified by direct API call, not just UI absence.
- The proof loop caps at 3 rounds.
- Tapping Complete awards XP instantly with no parent involvement; the parent is notified within seconds.
- An unreviewed completion auto-confirms at 72 hours with no XP change.
- `Mark not done` reverses the exact `awardedXp` and recalculates the streak; it is unavailable after 7 days.
- Repo-wide search for `nova`, `roommate`, `payroll`, `householdType`, `Household Games` returns no product matches.
- App builds and runs with no dead routes.
- Bottom tab bar reads: Home · Tasks · Plan · Ranks · **Poppins**.

---

## 2. Reward-model selection ("How should chores feel?")

### 2.1 Options

Reduce to exactly **five** options, in this order. Remove `No rewards` and remove `Custom`.

| # | Title | Subtitle | What it enables |
|---|-------|----------|-----------------|
| 1 | **XP only** | Levels and streaks that celebrate effort | XP engine on; no rewards; no allowance |
| 2 | **Allowance** | Real money for real help | Allowance on; XP hidden |
| 3 | **XP + Rewards** | Points that unlock real-life privileges | XP on; reward catalogue on; no money |
| 4 | **XP + Allowance** | Levels and money together | XP on; allowance on; no reward catalogue |
| 5 | **ChoreMaxx Full System** | Allowance, XP and rewards — everything on | All three subsystems on |

- Option 5 is the recommended default and should be pre-selected, marked with a subtle **Recommended** pill (not a checkmark that looks like a completed step).
- The subtitle for each option must state plainly what the child earns. Avoid abstractions like "quiet focus".
- Copy under the header stays: *"Change anytime in Settings."*

### 2.2 Data model

Replace whatever boolean soup exists with a single enum plus derived flags:

```ts
type RewardModel =
  | 'xp_only'
  | 'allowance'
  | 'xp_rewards'
  | 'xp_allowance'
  | 'full';

interface RewardModelCapabilities {
  xpEnabled: boolean;
  rewardsEnabled: boolean;      // the reward catalogue (screen time, movie pick, etc.)
  allowanceEnabled: boolean;    // money
}

const CAPABILITIES: Record<RewardModel, RewardModelCapabilities> = {
  xp_only:       { xpEnabled: true,  rewardsEnabled: false, allowanceEnabled: false },
  allowance:     { xpEnabled: false, rewardsEnabled: false, allowanceEnabled: true  },
  xp_rewards:    { xpEnabled: true,  rewardsEnabled: true,  allowanceEnabled: false },
  xp_allowance:  { xpEnabled: true,  rewardsEnabled: false, allowanceEnabled: true  },
  full:          { xpEnabled: true,  rewardsEnabled: true,  allowanceEnabled: true  },
};
```

Every screen that shows XP, rewards, or money must read from `CAPABILITIES[household.rewardModel]` — never from a scattered per-screen check. When `xpEnabled` is false, XP badges, the XP column on Ranks, and XP trophies are hidden app-wide (not shown as zero).

**Migration:** existing households on `no_rewards` → `xp_only`. Existing households on `custom` → map to the closest of the five based on their enabled flags; if ambiguous, `full`.

**Acceptance criteria — Section 2**
- The screen shows five cards, no "No rewards", no "Custom".
- Selecting `allowance` and completing onboarding results in zero XP references anywhere in the app.
- Changing the model in Settings updates every dependent screen without requiring an app restart.

---

## 3. Onboarding and household creation — full rebuild

This is the largest change. The current flow ends after the household is created and drops the user into their own profile with nothing set up. The new flow does not end until at least one family member exists with tasks assigned.

### 3.1 Canonical flow order

```
1. Welcome
2. "How should chores feel?"          → reward model (Section 2)
3. "What reward system would you      → Meritocracy vs Equity (Section 3.2)
    like to put in place?"
4. Household name                     → single question, single field
5. HOUSEHOLD ROSTER (hub)             → the new centre of gravity
      └── Add member (wizard)
            Step A: Member name
            Step B: Assign tasks       (Section 4)
            Step C: Rewards / allowance (Section 6)
            Step D: Review & Confirm member
      └── returns to roster
6. "Create household" (enabled once ≥1 member is fully set up)
7. Done → Home
```

Steps 2 and 3 both precede household creation, so that by the time the parent is naming their household, the earning rules are already settled and the roster screen can render the correct reward UI.

### 3.2 Meritocracy vs Equity screen

**The line "Hygiene tasks are tracked as streaks, not points" STAYS — reversed from Revision A.** It is the only place the app explains a live, load-bearing mechanic (19 hygiene tasks award zero XP by design), and removing it would leave parents to discover the behaviour as an apparent bug. Keep the sentence and its icon.

Two genuine fixes on this screen instead:
- **Fix its contrast.** The line currently renders in a dark low-opacity grey that is barely legible — this is very likely why it read as clutter. Raise it to the same secondary-text token used elsewhere, at a 4.5:1 minimum. A sentence worth keeping is worth being able to read.
- **Remove the duplicated "You can change this in Settings"** — it currently appears twice, once under the header and once beneath the hygiene line. Keep exactly one instance, under the header. That duplication is the real source of visual noise in this area.

Also surface the same explanation at the point of decision: an inline note at the top of the Personal Hygiene domain sheet reading *"Hygiene builds a daily streak instead of XP."* Setup copy is seen once; the domain sheet is seen every time a parent assigns a hygiene task.

If `rewardModel === 'allowance'` (XP disabled), this screen still applies — it governs whether harder tasks are worth more *money*. Change the illustrative rows from `30 XP / 10 XP / 5 XP` to currency when XP is disabled.

### 3.3 Step 4 — Household name

- One field. Label: `Household name`. Placeholder: e.g. `The Martin Family`.
- Remove: household type selector, rooms grid, custom room field, and the Create/Join segmented control from this screen. (Join-by-invite moves to the Welcome screen as a secondary text link — "Have an invite code?" — so that joining never walks a person through creation screens they don't need.)
- Continue is disabled until the field is non-empty.

### 3.4 Step 5 — The Household Roster (the hub)

This screen is the spine of setup and must be genuinely pleasant.

**Layout**
- Header: the household name, editable via a small pencil affordance.
- Subheader: `Add everyone who'll be pitching in.`
- A vertical list of member cards. Each card shows: avatar/initial, name, and a one-line status:
  - `3 tasks · Allowance set` (complete — card shows a subtle checkmark)
  - `No tasks yet` (incomplete — card shows a muted "Finish setup" chevron)
- A prominent **`+ Add family member`** row at the bottom of the list.
- Tapping an existing member re-enters the wizard at Step A with all their data pre-filled, so nothing is a one-way door.

**Footer (two actions, clearly differentiated)**
- Primary: **`Create household`** — enabled only when at least one member has completed the wizard through Step D. If some members are incomplete, tapping it shows a non-blocking sheet: *"2 members still need tasks. Create anyway?"* with `Finish them now` / `Create anyway`.
- Secondary (text button, not a competing filled button): **`Save and finish later`**.

**On "Save and finish later"** — this is the phrasing the product owner asked to be articulated better. Implement it as follows:
- Copy: **`Save and finish later`**, with helper text beneath: *"We'll keep everything you've set up. You can add the rest of your family any time from Settings → Household."*
- Behaviour: persist the partial household (name, reward model, meritocracy/equity, all members created so far including partial members) to the backend, mark `household.setupComplete = false`, and route to Home.
- Home then shows a single dismissible-but-recurring banner: *"Finish setting up your household — 2 members left"* with a `Continue setup` action that deep-links straight back to the roster.
- The banner disappears permanently once `setupComplete` is true.
- Never lose data on app kill. Persist after every wizard step, not only at the end.

### 3.5 The Add-member wizard

Four steps, with a slim progress indicator (4 dots), a working Back on every step, and state preserved when moving backward and forward.

**Step A — Name**
- Question: `What's their name?`
- Single text field. Optional: avatar colour picker (a row of six swatches) — this is cheap and adds a lot of warmth. A role toggle `Admin / Member` (Section 1.6), defaulting to Member.
- Continue enabled when name is non-empty.

**Step B — Assign tasks**
- Header: `What should {Name} take care of?`
- This is the task picker component (Section 4).
- Continue label: `Continue` when ≥1 task selected; if zero selected, allow continuing but label the secondary action `Skip for now` so the parent is never trapped.
- A running count is shown: `4 tasks selected`.

**Step C — Rewards / allowance**
- Header: `What would you like {Name} to earn?` — the name must be interpolated, exactly as requested.
- Content is driven by `CAPABILITIES[household.rewardModel]`:

| Reward model | Step C shows |
|---|---|
| `xp_only` | **Skipped entirely.** Jump straight from Step B to Step D. |
| `allowance` | Amount entry + frequency selector only |
| `xp_rewards` | Reward catalogue only |
| `xp_allowance` | Amount entry + frequency selector only |
| `full` | Reward catalogue **and** an allowance section |

- Detail behaviour is specified in Section 6.3.

**Step D — Review & Confirm**
- A quiet summary card: name, avatar, the list of assigned tasks grouped by domain, and the rewards/allowance with frequencies.
- Each section has an inline `Edit` link that jumps to the relevant step and returns here on save.
- Primary button: **`Confirm creation`**.
- On confirm: persist the member, return to the Roster (Step 5) with the new member's card animating in, and place focus so that `+ Add family member` is immediately reachable.

**Acceptance criteria — Section 3**
- A parent can go from app launch to a household with two fully configured children without ever hitting a dead end or losing entered data.
- Back navigation from Step D → C → B → A preserves every selection.
- Killing the app mid-wizard and reopening restores the partial household and the roster.
- With `xp_only`, Step C never appears.
- `Create household` is disabled with zero complete members and enabled with one.

---

## 4. The task picker — search + 15 domains

This component replaces the current over-complex task creation screen and is reused in three places: onboarding Step B, the Tasks tab "add task" flow, and any "assign more" entry point. **Build it once as a shared component.**

### 4.1 The task library — attached, authoritative

Seed from **`choremaxx-task-library.json`** (commit it to the repo). It is the single source of truth. Do not hand-author tasks in components.

**Actual contents — the revision doc said "139 tasks"; the real library is larger:**

| | |
|---|---|
| Domains | **15** (14 on the Chores tab, 1 on the Homework tab — Section 4.6) |
| Groups | **43** |
| Tasks | **150** total |
| XP-scoring | **131** |
| Streak-tracked (Personal Hygiene) | **19** |
| XP distribution | 35×5, 43×10, 26×15, 12×20, 11×25, 4×30 |
| Frequencies | 9 values (Section 5.1) |

Shape:

```ts
interface TaskLibrary {
  version: string;
  xpValues: [5, 10, 15, 20, 25, 30];
  frequencies: Frequency[];
  domains: TaskDomain[];
}

interface TaskDomain {
  id: string;                       // 'kitchen_dining'
  name: string;                     // 'Kitchen & Dining'
  tab: 'chores' | 'homework';       // routes the domain to the right tab
  tracking: 'xp' | 'streak';        // 'streak' only for personal_hygiene
  groups: TaskGroup[];
}

interface TaskGroup {
  id: string;                       // 'do_the_dishes'
  name: string;                     // 'Do the Dishes'
  domainId: string;
  bundleBonusXp: number;            // +10 when the whole group is assigned; 0 for streak groups
  tasks: LibraryTask[];
}

interface LibraryTask {
  id: string;                       // 'load_the_dishwasher' — stable, never renumber
  name: string;
  domainId: string;
  groupId: string;
  tracking: 'xp' | 'streak';
  xp: number;                       // 0 for streak tasks
  defaultFrequency: Frequency;
  searchTerms: string[];            // synonyms for predictive search
}
```

**Three rules that fall out of the library and must be implemented, not assumed:**

1. **`tracking: 'streak'` tasks award zero XP.** All 19 Personal Hygiene tasks. Completing one increments that member's hygiene streak counter and awards nothing. This is load-bearing: it exists so a child cannot out-earn a sibling who mowed the lawn by brushing their teeth and washing their hands. Never award XP for a streak task, never show an XP badge on one, and never include one in XP leaderboard math. See Section 13.8 for the copy consequence.

2. **`bundleBonusXp`** — when a parent uses `Select all` on a group and assigns the whole bundle, add a flat **+10 XP** on top of the summed task XP, awarded once when every task in that group is completed within the same period. This rewards bundling without being farmable. If the group is assigned partially, no bonus.

3. **XP is a snapshot, not a lookup.** When a task is assigned, copy the XP value onto the `TaskDefinition`, and copy it again onto each `TaskOccurrence` as `awardedXp`. Never read XP from the library at completion time — editing the library or switching scoring mode must not retroactively change what a child already earned.

**Equity mode override:** in `scoringMode === 'equity'`, every XP-scoring task is worth a flat **10 XP** regardless of its library value, applied at assignment time and snapshotted as above. Streak tasks are unaffected. In `meritocracy`, library values apply as-is.

**Frequency is a household-level override, not a constant.** Garbage day is Tuesday in one city and Friday in another. Store the frequency on the `TaskDefinition`, seeded from `defaultFrequency`, editable per household.

### 4.2 Layout

```
┌─────────────────────────────────────┐
│  ⌕  Search tasks…                    │   ← predictive, always visible, autofocus off
├─────────────────────────────────────┤
│                                      │
│   ▢ ▢ ▢ ▢          14 domain tiles   │   ← 4-column grid, icon + label
│   ▢ ▢ ▢ ▢          iOS-home-screen   │      rounded squares, generous spacing
│   ▢ ▢ ▢ ▢          style             │      (Homework & Education lives on
│   ▢ ▢                                │       its own tab — Section 4.6)
│                                      │
├─────────────────────────────────────┤
│  Selected: 4 tasks           [Clear] │
│  ⟨ chips of selected tasks ⟩         │
└─────────────────────────────────────┘
```

### 4.3 Predictive search

- Fires on every keystroke after the first character, debounced ~120ms, executed locally over the seeded library (no network round-trip).
- Matching: case- and accent-insensitive substring match against `name` **and** `searchTerms`, plus a light fuzzy pass (Levenshtein ≤1 for tokens of 5+ characters) so `dishwahser` still finds `Load the dishwasher`.
- Ranking: exact prefix match on `name` → prefix match on any token → substring match → synonym match → fuzzy match.
- Result rows show `Task name` with a small muted `Domain · Group` caption so the parent knows where it came from.
- Cap at 8 visible results with the list scrollable beyond that.
- Tapping a result selects it immediately and clears the query, returning focus to the field so multiple tasks can be added in a rhythm without extra taps.
- If there are no matches, the empty state shows: *"No task called '{query}'."* with a single button **`Create "{query}" as a new task`** (Section 4.5).

### 4.4 Domain tiles → group → task drilldown

- Tapping a domain tile opens a sheet (not a full page push — a sheet keeps the parent oriented).
- Sheet header: the domain name and a close affordance.
- Body: each **group** rendered as a collapsible section header (e.g. `Do the dishes`, `Clean the kitchen`, `Table duty`) with its child tasks beneath as multi-select rows with checkboxes.
- Tapping a group *header* toggles expand/collapse. A separate `Select all` affordance on the header row selects every task in that group — this is the single biggest time-saver for a parent setting up a child and should be present.
- Selections are live: closing the sheet keeps them, and the selected-chips tray at the bottom of the picker updates immediately.
- Sheet footer: `Done` (dismisses the sheet, keeps selections).

### 4.5 Creating a custom task

Third path, always available, never the primary one. Entry points: the empty-search state, and a small `Create a task` text link beneath the domain grid.

The custom task sheet is drastically simplified from its current state:

- Keep: **Task name**, **Domain** (a required picker among the 14 chore domains, or the Homework domain if created from that tab — this replaces Room), **Repeat** (the 9 frequencies, Section 5.1), **Due time** (Section 5), **XP value** (a picker of 5/10/15/20/25/30, defaulting to 15; hidden entirely in Equity mode and in `allowance`-only households).
- Keep: `Require photo proof after complete` checkbox.
- Keep: `Assign to` (pre-filled with the current member in the onboarding context).
- **Remove:** the `Room (optional)` field entirely.
- **Remove:** the `Priority (Low / Medium / High)` control entirely — field, UI, sorting logic, and any badge on task cards. **Confirmed.** Priority duplicates what XP weighting already expresses and adds a decision with no downstream effect.
- **Placeholder text:** replace `e.g. Call plumber about sink` with **`e.g. Clean bedroom`**. The current placeholder describes an errand, not a chore, and misleads people about what the app is for. Audit for other placeholder examples in the same family and replace with real chores.
- Custom tasks are saved to the household's own library and appear in future searches for that household, flagged `isCustom: true`.

### 4.6 Homework is a separate tab — confirmed

Homework stays distinct from chores and keeps its own tab **next to Tasks**.

**Implementation:**
- The **Tasks** screen carries a top-level segmented control: **`Chores | Homework`**. Keep it here, not buried in the custom-task sheet. Remove the `Task / Homework` toggle from the custom-task sheet — the sheet inherits its type from whichever tab you opened it from.
- The `homework_education` domain (11 tasks, 3 groups: `Homework`, `Practice & Reading`, `School Admin`) is routed by its `tab: 'homework'` flag and **must not appear in the chores domain grid**. It appears only under the Homework tab. Rendering it in both places would double-count completion and break search — the library's own design notes flag this exact failure mode.
- Under the Homework tab, skip the domain grid entirely (there is only one domain). Show the three groups directly, plus the same predictive search scoped to homework tasks.
- Homework tasks are ordinary XP-scoring tasks. They use the same occurrence engine, the same deadlines, the same late/missed rules. `Do your homework` at 20 XP on `weekdays` is structurally identical to `Mow the lawn` at 30 XP on `weekly`.
- Homework counts toward XP, trophies, and the daily streak like any other task. It does **not** get a separate streak.
- Home and Ranks aggregate chores and homework together. Only the Tasks screen splits them.

**Why the split earns its keep:** homework has a different owner in the parent's head (school, not household) and a different rhythm (weekdays, term-time). Keeping it one tap away rather than mixed into the chore list is the right call — but it must stay one *view*, not one *system*. Do not fork the data model.

**Acceptance criteria — Section 4**
- Typing `dish` surfaces every dish-related task across domains within one frame.
- Tapping `Kitchen` opens groups `Do the dishes`, `Clean the kitchen`, `Table duty` with all child tasks selectable, and `Select all` works per group.
- At no point are all 150 tasks rendered in a single flat list.
- The picker is a single shared component with no duplicated implementation between onboarding and the Tasks tab.
- No `Room` field exists anywhere.

---

## 5. Deadlines and the recurrence engine

Two separate problems: tasks have no time component, and recurring tasks are being regenerated incorrectly.

### 5.1 Every task gets a due time

- Add `dueAt: DateTime` to the task model (replacing or augmenting any date-only field). Store in UTC; render in the household's local timezone. Store the household timezone explicitly on the household record — do not rely on the device.
- **19:00 local is the universal deadline hour.** Every frequency resolves to a *date*; the time is always 7:00 PM unless the parent overrides it. Defaults, applied automatically on assignment and editable per task:

| Frequency | Occurrences generated | Default deadline |
|---|---|---|
| **`daily`** | One per day | Today at **19:00** |
| **`weekdays`** | One per Mon–Fri, none on Sat/Sun | That weekday at **19:00** |
| **`2x_weekly`** | Two per week, default **Wednesday + Saturday** (parent-editable days) | Each of those days at **19:00** |
| **`weekly`** | One per week | **Sunday** at **19:00** |
| **`biweekly`** | One every other week | **Sunday** at **19:00**, alternating weeks from the assignment date |
| **`monthly`** | One per month | The **last Sunday of the month** at **19:00** |
| **`quarterly`** | One per quarter (Jan/Apr/Jul/Oct) | The **last Sunday of the quarter's final month** at **19:00** |
| **`seasonal`** | Parent-triggered within a season window | No auto-deadline. Treated as `as_needed` until the parent schedules it. |
| **`as_needed`** | None — parent triggers manually | Due **today at 19:00** from the moment it is triggered |
| **`none`** (one-off) | One | Today at **19:00**, date freely editable |

**Two frequencies need explicit handling and are the likeliest source of bugs:**
- **`seasonal`** (Rake the leaves, Shovel the snow) must **never** auto-generate. Generating "Shovel the snow" every week in July is the kind of thing that gets an app deleted. Store them as dormant definitions surfaced under a `Seasonal` section the parent can activate; once activated they behave as `weekly` until deactivated.
- **`as_needed`** must never auto-generate either. It produces an occurrence only when the parent taps `Assign now`. It is excluded from streak and household-completion denominators until triggered.

**Streak-tracked tasks (Personal Hygiene)** carry deadlines like anything else, but their misses do not break the daily task streak — they break the separate hygiene streak. This rule already exists in the streak-engine companion spec; do not re-implement it, wire to it.

- The custom task sheet gains a **Due time** row showing the default (e.g. `Sunday, 7:00 PM`) with a tap target that opens a time picker (and a date picker for one-off tasks). The parent should be able to accept the default without ever opening the picker — that's the point of having defaults.
- Task cards display the deadline as relative-but-precise: `Due today, 7:00 PM`, `Due Sunday, 7:00 PM`, `Overdue since yesterday`.
- Overdue tasks get a distinct but non-alarming treatment (a warm amber accent, not red). This is a family app; a child's dashboard should not look like a bug tracker.

**Last-Sunday calculation** — implement carefully and unit-test it:

```ts
function lastSundayOfMonth(year: number, month: number): Date {
  // month is 0-indexed
  const last = new Date(year, month + 1, 0);       // last day of month
  const offset = last.getDay();                    // 0 = Sunday
  return new Date(year, month + 1, 0 - offset);
}
```
Test cases: a month ending on a Sunday (the last Sunday is the final day), a month ending on a Monday (the last Sunday is the 2nd-to-last day), February in a leap year, and a month with five Sundays.

### 5.2 Fix the duplicate-task bug

**Current broken behaviour:** completing a daily task immediately generates the next instance, so a child who completes "Wipe down kitchen counters" four times in one afternoon ends up with four completed instances and a fifth pending — visible in the reported screenshot as a wall of identical rows.

**Required behaviour:** *completion never spawns the next occurrence.* Occurrence generation is time-based only.

Implement as follows:

1. **Separate the concepts.** A `TaskDefinition` (the recurring rule: what, who, how often, what time) is distinct from a `TaskOccurrence` (a single dated instance with a status). The current model appears to conflate them; splitting them is what actually fixes this class of bug.

```ts
interface TaskDefinition {
  id: string;
  libraryTaskId?: string;
  name: string;
  domainId: string;
  assigneeId: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  dueTimeLocal: string;   // '19:00'
  xp: number;
  requiresPhoto: boolean;
  active: boolean;
}

interface TaskOccurrence {
  id: string;
  definitionId: string;
  occurrenceDate: string;   // 'YYYY-MM-DD' — the period key, UNIQUE with definitionId
  dueAt: string;            // ISO UTC
  status: 'pending' | 'completed' | 'missed';
  completedAt?: string;
}
```

2. **Enforce uniqueness at the database level:** a unique constraint on `(definitionId, occurrenceDate)`. This makes duplicates structurally impossible even if a client misbehaves or a request is retried. This constraint is the actual fix; everything else is defence in depth.

3. **Generate occurrences on a schedule, not on an event.** At **00:00 household-local time**, a job (server cron, or a client-side catch-up on first foreground of the day if there's no backend) materialises the day's occurrences:
   - Daily definitions → one occurrence dated today.
   - Weekly definitions → one occurrence, generated at 00:00 on the first day of the week, due Sunday 19:00.
   - Monthly definitions → one occurrence, generated at 00:00 on the 1st, due the last Sunday 19:00.
   - Use upsert-on-conflict-do-nothing so re-running the job is harmless and idempotent.

4. **Completion does exactly one thing:** set `status = 'completed'`, stamp `completedAt`, award XP/allowance. It must not create, schedule, or queue anything.

5. **Guard against the current bug's aftermath:** once an occurrence is completed, the row becomes non-interactive for the rest of the period. Show it in the completed section with the strikethrough treatment; do not allow re-completion.

6. **Late vs. missed — the confirmed model.** These are two different states with two different consequences. Getting this distinction right is the single most user-visible piece of the recurrence work.

```
19:00 ──────────────── 23:59 │ 00:00 ────────────────────
   deadline passes           │   day rolls over
        ↓                    │        ↓
   status: LATE              │   status: MISSED
   ✅ completable            │   ⚠️ completable (full XP)
   ✅ full XP                │   ❌ streak BREAKS
   ✅ streak PRESERVED       │   ⚠️ redemption ladder applies
   🕐 late indicator shown   │   🔔 parent notified
```

**`late` (new status).** From `dueAt` until 23:59:59 household-local on the same day. The task is completable at full XP and **the streak is preserved**. The occurrence is stamped `completedLate: true` and displays a **late indicator** — a small clock glyph plus the caption `Completed late · 7:42 PM`. The indicator is informational, not punitive: no red, no strikethrough, no penalty. It persists in history so a parent can see a pattern of lateness without the app having to punish it.

**`missed`.** Assigned at daily rollover (00:00) to any occurrence still `pending` or `late`-uncompleted from the previous day. Only *now* do consequences apply: the daily streak breaks, the parent is notified, and the redemption ladder from the streak-engine companion spec becomes available (−15% / −30% / −50% of that week's gross XP to buy the streak back). **Do not re-implement that ladder here — call into it.**

A missed task remains completable after rollover at **full XP**. The penalty was the broken streak; docking the XP as well would double-punish and would make the redemption arithmetic in the companion spec incorrect.

**New model fields:**
```ts
interface TaskOccurrence {
  // ...as above
  status: 'pending' | 'late' | 'completed' | 'missed';
  completedLate: boolean;      // true if completedAt > dueAt
  latenessMinutes?: number;    // for parent-facing history only
}
```

**Implementation notes:**
- `late` is a *derived* display state between `dueAt` and rollover — compute it client-side from `dueAt` vs. now rather than writing a status transition at 19:00. Writing a row transition at 19:00 for every task in every household is a scheduled job you do not need, and it will drift.
- `missed` **is** a real persisted transition, written by the 00:00 rollover job. It must be idempotent.
- `completedLate` is set at completion time by comparing `completedAt > dueAt`. It is true for both same-day-late and after-rollover completions.
- **Household completion** (the 100% celebration) counts a late completion as complete for that day, provided it lands before rollover. A task completed after rollover does not retroactively restore the previous day's household completion.
- **XP timing is not part of this.** Because XP is awarded the instant the child taps Complete (§1.7), lateness never interacts with reward timing — there is no approval step to reconcile against a deadline. `late` affects the *indicator* and nothing else; `missed` affects the *streak* and nothing else. Neither ever reduces XP.

**Copy:** never use the word "failed". Late reads as `Completed late`. Missed reads as `Missed yesterday` with a `Complete it now` action. The tone is a nudge, not a report card.

7. **Catch-up on cold start:** if the app was closed for three days, the foreground handler must generate the missed days' occurrences and resolve their statuses, rather than generating three copies of today.

8. **Clean up existing data:** write a one-time migration that collapses duplicate same-day completions of the same task into a single occurrence, keeping the earliest `completedAt`, and reconciles the XP that was over-awarded. Log what it changed.

**Acceptance criteria — Section 5**
- Completing a daily task produces no new row until the device clock passes midnight.
- Advancing the simulator clock past midnight produces exactly one new occurrence per active daily definition.
- Advancing the clock forward by five days and reopening produces the correct occurrences for each intervening day, never five copies of one day.
- The unique constraint exists and is verified by an integration test that attempts a double-insert.
- The migration reduces the reported four-copies-of-"Wipe down kitchen counters" case to one.

---

## 6. Reward system rebuild

### 6.1 Remove XP costs from rewards

Rewards are **not** purchased with XP. Delete all XP pricing from reward cards, the reward catalogue, and the redemption flow. Rewards are granted by the parent on a frequency (daily/weekly/monthly) for meeting the assigned chores. Remove any "you need 200 more XP" copy, progress-to-purchase bars, and XP balance deductions.

XP continues to exist for **levels, streaks, ranks, and trophies only**. This separation should be visible in the copy: XP is about standing, rewards and allowance are about earning.

### 6.2 Preset reward catalogue

Seed exactly these presets. **No emoji anywhere on the reward pages** — use a single consistent line-icon set, or no icon at all if that reads cleaner.

**Duplicates removed — confirmed.** The source list had two collisions. Both are resolved:
- `Pick Dinner` + `Pick Dinner/Breakfast` → split into two distinct rewards: **`Choose dinner`** and **`Choose breakfast`**.
- `Choose Movie` + `Choose Weekend Movie Night` → merged into a single **`Choose the movie`**.

Final catalogue — exactly **nine** presets, in this display order:

| # | Reward | Suggested default frequency | Quantity options |
|---|---|---|---|
| 1 | **Additional screen time** | Daily | 30 min / 1 hr / 2 hrs |
| 2 | **Video game time** | Daily | 30 min / 1 hr / 2 hrs |
| 3 | **Dessert choice** | Daily | — |
| 4 | **Choose dinner** | Weekly | — |
| 5 | **Choose breakfast** | Weekly | — |
| 6 | **Choose the movie** | Weekly | — |
| 7 | **New video game** | Monthly | — |
| 8 | **Big outing** — bowling, trampoline park, arcade, cinema | Monthly | — |
| 9 | **Room upgrade item** | Monthly | — |

Notes:
- Order is daily-tier first, then weekly, then monthly. A parent scanning the list should feel the escalation without a header telling them.
- The suggested frequency is a *default in the picker*, not a constraint. Any reward can be set to any frequency.
- Quantity, where offered, is three fixed options. Do not build a slider.
- `Big outing` shows its examples as muted subtitle text, not in the label. The label stays two words.

### 6.3 The reward assignment flow (onboarding Step C, and Settings)

Header: `What would you like {Name} to earn?`

**If `rewardsEnabled`:**
1. A clean list/grid of the 10 presets plus any household-created rewards.
2. Tapping a reward selects it and reveals, inline beneath it, a **frequency scroll picker: `Daily / Weekly / Monthly`** — pre-set to that reward's suggested default.
3. Once at least one reward is configured, an **`Add another reward`** button appears beneath the list. It does not appear before the first selection, to keep the initial screen quiet.
4. Selected rewards appear as a summary list with their frequency and an `×` to remove.

**If `allowanceEnabled`:**
- A single **Amount** field with a numeric keypad and the household currency symbol, plus the same **`Daily / Weekly / Monthly`** scroll picker. No preset amount chips — see Section 9.7.

**If both (`full`):**
- Two clearly separated sections on the same screen: `Rewards` and `Allowance`. Do not make this two screens; it's one question with two parts.

**If neither (`xp_only`):**
- The step is skipped entirely and the wizard advances from Step B directly to Step D (Review). Do not render an empty screen with a Continue button.

### 6.4 Create a custom reward

Add a **`Create reward`** button at the end of the preset list, for rewards not covered by the presets.

Sheet contents, kept deliberately minimal:
- `Reward name` (text)
- `Frequency` (Daily / Weekly / Monthly)
- Optional: `Notes` (one line, e.g. "must be finished before 9pm")
- Save. The custom reward is added to the household catalogue, available for every member thereafter, and marked `isCustom: true` so it can be edited or deleted from Settings.

**Acceptance criteria — Section 6**
- Zero emoji characters render on any reward screen. Verify by grepping the reward components for emoji ranges.
- No XP cost appears anywhere in the reward catalogue or redemption flow.
- A parent can assign three rewards with three different frequencies to one child in a single pass.
- `Create reward` produces a reward that persists and is assignable to other members.

---

## 7. Home screen fixes

### 7.1 Remove the Fairness metric

The `Household Health` card currently shows `Completion · Fairness · Streak`. **Delete Fairness** — its logic, its bar, its label, and any backend computation feeding it. Fairness was a roommate-era concept (who's pulling their weight relative to others) and it is corrosive in a family context.

The card becomes two metrics: **Completion** and **Streak**. Rebalance the layout so two bars occupy the width gracefully rather than leaving a gap where the third was.

### 7.2 Per-member streaks

Each member keeps their **own independent streak**, visible on their profile and on the Ranks page. The household streak on the Home card is separate and should be defined explicitly: *the household streak increments on any day where 100% of that day's due occurrences across all members were completed by their deadlines.* Document this definition in a code comment and in the info tooltip on the card, because an undefined streak rule generates support questions.

### 7.3 Fix the "Switch account" overlap

Tapping the name/avatar in the header currently renders a `Switch account` popover **on top of** the greeting and the summary text, producing unreadable overlapping layers.

**Required fix:** remove the switch-account popover from the name button. Instead:
- Tapping the name/avatar opens the member's own profile (or does nothing, if profile isn't ready).
- Account switching moves to **Settings → Switch member**, presented as a proper modal sheet with a scrim, correct z-index, and its own background — never a transparent overlay on live content.
- Audit every popover in the app for the same bug: any popover must render on an opaque surface above a dimming scrim, with `pointer-events` disabled on the content beneath.

### 7.4 Greeting truncation

`Good morning, mugaboci…` truncates mid-name and looks broken. Use the member's **display first name** in the greeting, and if the display name still exceeds the line, wrap to two lines rather than truncating. Ellipsising a person's own name in a greeting is exactly the kind of small carelessness that undercuts "classy".

**Acceptance criteria — Section 7**
- Household Health shows exactly two metrics.
- No text overlaps on the Home screen at any supported dynamic-type size.
- The greeting never shows a truncated name.

---

## 8. Rewards Center and Ranks fixes

### 8.1 Rewards Center → Allowance tab

- `This Week's Payroll` → **`This Week's Allowance`** (Section 1.4).
- Keep the three-stat row (`Unpaid / Approved / Pending`), restyled so the numbers and labels have equal visual weight — currently the numbers dominate and the labels are barely legible.
- `Pay Now` → `Send Allowance`.

### 8.2 Bonus / quick-pay sheet — simplify

The current sheet offers a mixed row of `$5 / $10 / $20 / Extra screen / Treat night`, a `Custom label` field, and a `Note`. Mixing money and non-money in one selector is the source of the confusion.

**Required:** remove the non-money chips and the custom-label field. Keep **Amount only**, entered through a **scroll menu (picker wheel)**. Retain the optional `Note` field. The sheet becomes: `Person → Amount (scroll) → Note (optional) → Send / Cancel`.

Also fix: the primary action button in the current screenshot is invisible (a dark button on a dark background above `Cancel`). The primary action must be a filled, high-contrast button with a clear label.

### 8.3 Achievements — text contrast

On the Ranks/Achievements page, achievement titles such as `LIVE COLLECTION` render in a dark font on a dark background and are effectively invisible.

- Set all achievement titles to the same white/near-white token used by the rest of the achievements section.
- Audit the *entire* achievements and trophies surface for the same problem — locked-state trophy names and their `Locked · 100 XP` captions are similarly low-contrast in the current build.
- Locked items should read as *locked* through opacity of the **icon** and a lock glyph, not through unreadable text. The text stays legible; the artwork dims.
- Verify every text token on these screens against a 4.5:1 contrast floor.

**Acceptance criteria — Section 8**
- The word "payroll" appears nowhere in the app.
- The bonus sheet offers money only, via a scroll picker, with a visible primary button.
- Every achievement and trophy label is legible on its background at default brightness.

---

## 9. XP trophy ladder — top out at 100,000 XP

**Most Glorious = 100,000 XP.** All twelve names unchanged, thresholds reshaped around them so `Thousand Club` sits at exactly 1,000 and `Ten Thousand` at exactly 10,000 — the names stay literally true.

| # | Trophy | Old | **New** | @ 55 XP/day | @ 90 XP/day |
|---|--------|-----|---------|---|---|
| 1 | First Hundred | 100 | **100** | 2 days | 1 day |
| 2 | Rising Star | 500 | **400** | 1 week | 4 days |
| 3 | **Thousand Club** | 1,000 | **1,000** | ~3 weeks | ~11 days |
| 4 | Household Hero | 2,500 | **2,000** | ~5 weeks | ~3 weeks |
| 5 | Decorated | 5,000 | **4,000** | ~2.5 months | ~6 weeks |
| 6 | **Ten Thousand** | 10,000 | **10,000** | ~6 months | ~4 months |
| 7 | Immortal Badge | 25,000 | **18,000** | ~11 months | ~7 months |
| 8 | Dynasty Trophy | 50,000 | **28,000** | ~1.4 years | ~10 months |
| 9 | Ascendant Cup | 100,000 | **40,000** | ~2 years | ~1.2 years |
| 10 | Sovereign Crown | 250,000 | **55,000** | ~2.7 years | ~1.7 years |
| 11 | Eternal Laurel | 500,000 | **75,000** | ~3.7 years | ~2.3 years |
| 12 | **Most Glorious** | 1,000,000 | **100,000** | **~5 years** | **~3 years** |

**On the three-year target.** 100,000 XP is a three-year climb at ~90 XP/day and a five-year climb at ~55. The 55 figure was an estimate for a light load — 4–5 assigned tasks a day; 90 XP/day is 6–8 tasks, which is an ordinary Saturday in most households and entirely normal once homework and hygiene streaks are in play. **Both targets are met — which one a given family lands on depends on how much they assign, which is exactly where that decision belongs.** No code change is needed to serve either; do not build a difficulty setting for this.

**Shape:** four trophies inside the first five weeks to hook a child, the midpoint at six months, and a summit that spans a real stretch of childhood. Tiers 9–12 sit closer together on purpose — the last stretch should feel like a climb with the peak in sight, not an asymptote.

**Equity mode note:** at a flat 10 XP per task, a child doing 4–5 tasks/day earns ~45–50 XP/day — roughly 15% slower than meritocracy. Close enough that a single ladder serves both modes. Do not fork it.

**Two-child sanity check:** adding a second child does not change per-child pacing, since XP is per-member. Verify the leaderboard sorts on absolute XP and does not normalise by tenure — a younger sibling joining later should visibly be lower, and catching up should be the point.

**Migration:** thresholds must be data, not hardcoded constants scattered across components — put them in one `TROPHY_TIERS` array. Existing members will retroactively unlock trophies under the new thresholds; that's correct and desirable, but ensure the unlock does not fire twelve celebratory animations and twelve push notifications at once. On migration, unlock silently and show a single consolidated card on next open: *"You've unlocked 4 trophies."*

**Acceptance criteria — Section 9**
- `TROPHY_TIERS` is the single source of truth; no threshold literals elsewhere.
- A member with 3,500 XP shows tiers 1–6 unlocked and 7 as the next target.
- Migration produces at most one notification per member.

---

## 10. Tasks tab — simplification pass

The Tasks tab must reflect the same simplicity as the picker.

- **Filter chips:** the current `All / Mine / Kids / Homework` row plus a filter icon is close to right. Replace `Kids` with per-member filtering only if the household has 3+ members; below that it's noise. Remove the separate filter icon if its contents duplicate the chips.
- **Task cards:** show task name, assignee avatar, due time, XP (only when `xpEnabled`), and recurrence badge. **Remove the room badge.** Add the domain as a small muted caption only if it aids scanning — test both.
- **Grouping:** group by `Due today / Due this week / Later / Overdue`, with completed items collapsed into a `Completed today (3)` disclosure at the bottom. The current build shows completed items inline at full height, which is what made the duplicate bug look catastrophic.
- **Empty state:** `All clear for today.` with a quiet `Assign a task` action. No exclamation marks, no confetti.
- **Search:** the Tasks tab search bar should search *assigned* tasks, not the library. Keep the two mental models distinct — searching your list versus browsing the catalogue.

---

## 11. Data model summary and migrations

### 11.1 Schema changes

| Change | Action |
|---|---|
| `household.householdType` | Drop |
| `household.rooms` | Drop |
| `household.rewardModel` | Add (enum, Section 2.2) |
| `household.scoringMode` | Add (`meritocracy` \| `equity`) |
| `household.timezone` | Add (IANA string) |
| `household.setupComplete` | Add (boolean, default false) |
| `member.role` | Constrain to `admin` \| `member` |
| `task.room` | Drop |
| `task.domainId` | Add (FK to the 15 domains) |
| `task` → split | Into `TaskDefinition` + `TaskOccurrence` (Section 5.2) |
| `TaskOccurrence` | Unique index on `(definitionId, occurrenceDate)` |
| `TaskDefinition.dueTimeLocal` | Add (default `'19:00'`) |
| `reward.xpCost` | Drop |
| `reward.frequency` | Add (`daily` \| `weekly` \| `monthly`) |
| `reward.isCustom` | Add |
| Fairness metric fields | Drop |

### 11.2 Room → domain mapping (for migrating existing tasks)

`Kitchen → Kitchen`, `Living room → Living areas`, `Bathroom → Bathroom`, `Bedrooms → Bedroom`, `Laundry → Laundry`, `Outdoor → Outdoor/Yard`. Anything unmapped or custom → the closest domain by name similarity, falling back to a general/miscellaneous domain. Log every fallback.

### 11.3 Migration safety

- Write migrations as reversible where possible; where not, snapshot the affected tables first.
- Run the whole migration set against a copy of production data before shipping and report row counts changed per step.
- Ship behind a version gate so a client on the old build cannot write to the new schema.

---

## 12. QA checklist

**Fresh install**
- [ ] Complete onboarding as `full`, creating 2 members with 4 tasks each and rewards + allowance.
- [ ] Complete onboarding as `xp_only` — verify Step C is skipped and no money/reward UI appears anywhere.
- [ ] Complete onboarding as `allowance` — verify no XP appears anywhere, including Ranks and trophies.
- [ ] Use `Save and finish later` mid-roster; kill the app; reopen; confirm the banner and full state restoration.

**Task library and picker**
- [ ] Seed loads: **150 tasks, 15 domains, 43 groups, 131 XP-scoring, 19 streak**. Assert these counts in a test.
- [ ] XP distribution asserts as 35×5, 43×10, 26×15, 12×20, 11×25, 4×30.
- [ ] Search finds tasks by name, by synonym (`hoover` → Vacuum the bedroom), and with a one-character typo.
- [ ] All **14** chore domain tiles open and show their groups. `Homework & Education` appears **only** on the Homework tab.
- [ ] `Select all` on a group works, is reflected in the count, and applies the +10 bundle bonus only on full-group completion.
- [ ] Creating a custom task requires a domain, offers no room field, and offers no priority field.
- [ ] Completing a hygiene task awards **0 XP** and increments the hygiene streak.
- [ ] Switching to Equity mode makes newly assigned tasks worth 10 XP; already-assigned tasks keep their snapshotted value.

**Recurrence**
- [ ] Complete a daily task 4× in a session — only one completed row exists, no new pending row.
- [ ] Roll the clock to 00:01 — exactly one new occurrence per daily definition.
- [ ] Roll the clock 5 days — correct occurrence per day, correct missed statuses.
- [ ] A weekly task is due Sunday 19:00; a monthly task is due the last Sunday 19:00 (test a month ending on a Sunday).
- [ ] `weekdays` generates Mon–Fri only, never Saturday or Sunday.
- [ ] `seasonal` generates **nothing** until the parent activates it — verify "Shovel the snow" produces no July occurrences.
- [ ] `as_needed` generates nothing until triggered and is excluded from completion denominators.

**Late / missed / approval**
- [ ] Complete at 19:30 → `completed`, full XP, streak intact, late indicator shown.
- [ ] Leave uncompleted past 00:00 → `missed`, streak breaks, parent notified, redemption ladder offered.
- [ ] Complete a `missed` task the next day → full XP awarded, streak stays broken.
- [ ] Tap Complete at 18:50 → XP lands immediately, parent notified, no approval required.
- [ ] Parent confirms 30 hours later → no XP change, no streak change.
- [ ] Parent takes no action → auto-confirms at 72h, XP unchanged.
- [ ] `Ask for another photo` leaves XP and streak untouched; loop caps at 3 rounds.
- [ ] `Mark not done` reverses the exact awarded XP and recalculates the streak from that day.
- [ ] `Mark not done` is unavailable 8 days after completion.
- [ ] A completed-but-unreviewed occurrence is **never** turned into `missed` by rollover.
- [ ] A member account cannot approve, assign, request proof, or send allowance via direct API call.

**UI correctness**
- [ ] No emoji on reward screens.
- [ ] No "Nova", "roommate", "payroll", "Fairness", "Household Games", "Room" strings.
- [ ] The `Hygiene tasks are tracked as streaks` line is **present** and legible at 4.5:1; the duplicated `You can change this in Settings` is gone.
- [ ] The custom-task placeholder reads `e.g. Clean bedroom`.
- [ ] No overlapping text when tapping the name in the Home header.
- [ ] All achievement and trophy labels are legible; contrast checked at 4.5:1.
- [ ] Bonus sheet: amount-only scroll picker, visible primary button.
- [ ] Trophy ladder tops out at 100,000 XP.

**Regression**
- [ ] Existing household upgrades without data loss; duplicate-task cleanup migration ran and is logged.
- [ ] Dynamic type at largest setting: no clipping on any modified screen.
- [ ] Dark mode is the only mode currently — confirm no light-mode-only tokens were introduced.

---

## 13. Decisions — all resolved

Revision A's seven open questions are now settled. Recorded here so nobody re-litigates them mid-build.

| # | Question | **Decision** | Implemented in |
|---|---|---|---|
| 1 | Member roles and permissions | **Admin / Member.** Only admins assign tasks, approve completions, request additional proof, and send allowance. | §1.6, §1.7 |
| 2 | Task priority | **Removed entirely** — field, UI, and sorting. | §4.5 |
| 3 | Homework | **Separate — its own tab next to Tasks.** Own view, shared data model. | §4.6 |
| 4 | Late completion | **Allowed, full XP, streak preserved, with a late indicator.** Penalty applies only when the day rolls over with the task still uncompleted. | §5.2.6 |
| 8 | When is XP awarded? | **On the child tapping Complete.** Not on parent approval. Parent is notified immediately; verification runs after the fact and can reverse XP only via `Mark not done`. | §1.7 |
| 9 | Hygiene streak line | **Kept.** Fix its contrast and remove the duplicated Settings line instead. | §3.2 |
| 10 | Trophy ceiling | **Most Glorious = 100,000 XP.** Reaches the ~3-year target at a normal assignment load (~90 XP/day); ~5 years on a light load. | §9 |
| 5 | Reward duplicates | **Removed.** `Choose dinner` and `Choose breakfast` split into two; the two movie rewards merged into one. Nine presets total. | §6.2 |
| 6 | Trophy names | **All twelve kept unchanged.** Thresholds reshaped around them so `Thousand Club` = 1,000 and `Ten Thousand` = 10,000 exactly. | §9 |
| 7 | Task library | **Attached.** 150 tasks / 15 domains / 43 groups, seeded from `choremaxx-task-library.json`. | §4.1 |

---

## 13B. New items the task library surfaced — these need a decision

Four things emerged from reconciling the library against the revision document. Implement the stated default, add a `// TODO(product):`, and raise them.

**13B.1 — Hygiene explanation: RESOLVED, the line stays.** The sentence *"Hygiene tasks are tracked as streaks, not points"* is **kept** on the reward-system screen, reversing Revision A. It is the only place the app explains a live, load-bearing mechanic. The real problems on that screen were its unreadable contrast and a duplicated "You can change this in Settings" line — both fixed in §3.2. The same explanation is additionally surfaced on the Personal Hygiene domain sheet, where a parent sees it at the moment it matters.

**13B.2 — `2x_weekly` needs default days.** Nineteen tasks use it and the library doesn't say which two days. *Default implemented: Wednesday + Saturday, parent-editable per task.*

**13B.3 — Daily Routine may belong on streaks too.** The library's own design notes flag it: *Wake up on time*, *Fill your water bottle*, *Screens off by bedtime*, *Be in bed by bedtime* are all 5 XP and have the same character as hygiene — they benefit the child, not the household. Moving those 7 tasks to streak tracking would leave XP as a clean measure of household contribution. *Default implemented: leave on XP, unchanged.* Worth revisiting after the hygiene streak has been through testing.

**13B.4 — The 30 XP tier is thin and weather-dependent.** Only four tasks reach 30, and three of them (mow, rake, shovel) require a yard. A condo family effectively has no top-tier work, which flattens the ladder for them. *Default implemented: the custom-task sheet lets parents set XP directly (§4.5), which is the cheapest fix.* A richer option — promoting a 20 to a 30 when a task hasn't been done in 30+ days — is worth considering later but is not in this build.

---

## 14. What "classy and effortless" means for this build

Concretely, in review, reject any implementation that:

- Requires the parent to make a decision the app could have made for them (defaults exist for exactly this reason).
- Shows a number that is always zero (`0 XP`, `0 pending`) instead of hiding the element.
- Uses an emoji where an icon would do.
- Truncates a person's name.
- Renders light-grey text on a dark background.
- Puts two filled buttons of equal weight next to each other — there is always one primary action.
- Congratulates the user with more enthusiasm than the accomplishment warrants.
- Makes a step un-undoable.

The through-line for all of it: a parent should be able to set up two children, with real chores and real rewards, in under three minutes, and never once wonder what a screen is asking.

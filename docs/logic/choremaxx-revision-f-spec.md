# ChoreMaxx — Revision F
## Invites · Reward Requests · Task Page Rebuild · Allowance Rules

**Read this entire document before writing a single line of code.**

---

# ⛔ EXECUTION PROTOCOL

```
RULES OF ENGAGEMENT

1. §1 is a PREREQUISITE BUG FIX. It blocks Item 4.
   Do it first. Do not start Item 4 until §1 is verified.

2. Work items in the order given. Each has a STOP GATE.
   Paste test output before moving on.

3. Every task has a checkbox. Do not tick one you have not done.

4. Where this document gives exact copy in a code block, use it
   VERBATIM. Do not paraphrase. No exclamation marks. No emoji.

5. Do NOT invent features. If it is not in this document or a
   companion, it does not exist. This has already happened twice
   on this project.

6. Fill in the COMPLETION REPORT (§14). It is not optional.
```

### Companion documents — all still in force

| Document | Status |
|---|---|
| `choremaxx-MASTER-BRIEF.md` | **Read first.** §3 is the rule sheet; §4 is the reversal table. |
| `choremaxx-v2-cursor-spec.md` (Rev B) | In force, heavily superseded |
| `choremaxx-revision-c-spec.md` (Rev C) | In force — **this document amends §1.6** |
| `choremaxx-revision-d-spec.md` (Rev D) | In force — **this document re-issues §5.2** |
| `choremaxx-revision-e-spec.md` (Rev E) | In force — **Q1 is now answered, see §0.1** |
| `house-rules.json` | Single source for rule copy — **4 new entries in §13** |
| `choremaxx-task-library.json` | Seed data — **schema gains `shortName`, see §10.3** |

---

# §0 — ANSWERED QUESTIONS

## §0.1 — 🟢 Revision E Q1 is now ANSWERED: **B — keep it**

The reward request feature is **wanted and confirmed.** Revision E §2.3 notifications `N26` and `N27` are **live** — build them. Do not delete them.

The full specification is Item 3 (§4) of this document.

## §0.2 — Settled. Do not re-ask.

| # | Question | **Answer** |
|---|---|---|
| A | Item 11 — what does "validate" mean? | **An admin cannot mark another person's task complete.** Only the assignee taps Complete. The proof/confirmation system from Rev C **stays entirely intact.** |
| B | Item 3 — does the completion gate replace admin approval? | **No — it layers on top.** Completion is the *eligibility gate*. `approvalMode` then decides: `instant` grants immediately, `requires_approval` still pings the admin. |
| C | Item 9 — how many frequencies in the picker? | **All nine.** Daily / Weekly / Monthly shown directly, the other six behind a **`More`** row. |
| D | Invite security | **7-day expiry, single-use, admin can regenerate.** One active invite per member. |

---

# §1 — 🔴 PREREQUISITE: THE DUPLICATE OCCURRENCE BUG

## §1.1 — This blocks Item 4. Fix it first.

The submitted Tasks screenshot shows **"Load the dishwasher" three times** and **"Dry and put away dishes" three times** — every one of them `Today · Expired · Daily`. The counter reads `4 of 16 complete` against a list padded with duplicates.

**This is the bug specified in Revision B §5.2 and never fixed.** The unique constraint was never applied.

> ### ⚠️ ITEM 4 IS POINTLESS WITHOUT THIS
>
> Item 4 asks for expired tasks to move to their own tab. If the duplicates remain, all you have done is move the mess into a different tab. **Fix the cause, then build the tab.**

## §1.2 — The fix

**Task 1.2.a** — [ ] Apply a **unique database constraint** on `task_occurrences (definitionId, occurrenceDate)`. This is not application-level validation. It is a constraint in the schema, so duplicates become structurally impossible regardless of what any client does.

**Task 1.2.b** — [ ] Change every occurrence-generating write to `upsert ... on conflict do nothing`. The rollover job must be safely re-runnable.

**Task 1.2.c** — [ ] Confirm **completion never generates the next occurrence.** Generation is time-based only, at the 00:00 household-local rollover. Grep the completion handler for any create/insert/schedule call and delete it.

**Task 1.2.d** — [ ] Write a cleanup migration:
- Group existing occurrences by `(definitionId, occurrenceDate)`
- Keep **one**: the completed row if any exists, otherwise the earliest-created
- Delete the rest
- Reconcile any XP over-awarded by duplicate completions, writing a ledger `adjustment` entry
- **Report the row count deleted and the XP reconciled**

## §1.3 — Gate

```
[ ] F1.1  Unique constraint exists — verify by attempting a
          double-insert via direct DB call. It must be REJECTED.
[ ] F1.2  Complete a daily task 4× in one session → ONE row
[ ] F1.3  Run the rollover job twice → identical DB state
[ ] F1.4  Cleanup migration reduces the reported 3× duplicates to 1
[ ] F1.5  Task counter reads the true count (no inflated "of 16")
```

**🛑 Do not proceed to Item 4 until all five pass.**

---

# §2 — ITEM 1: SCROLL INDICATORS

> ### ⚠️ THIS WAS ALREADY SPECIFIED IN REVISION D §5.2 AND NOT BUILT
>
> A list of surfaces was not enough. This re-issue requires **a screenshot of every single one.**

## §2.1 — The indicator

**Task 2.1.a** — [ ] A **persistent vertical scroll line on the right edge** of every scrollable page. Not the transient iOS default that fades after a second.

| Property | Value |
|---|---|
| Width | 3pt |
| Inset from right edge | 2pt |
| Corner radius | fully rounded |
| Colour | theme accent at 40% opacity — **not** default grey |
| Visible | whenever content overflows |
| Hidden | when content fits, no empty track |

**Task 2.1.b** — [ ] A default grey bar on the dark brown background reads as a rendering artefact. Take the colour from the theme file. **No raw hex in components.**

## §2.2 — Every surface. Screenshot each one.

- [ ] Tasks — Chores tab
- [ ] Tasks — Homework tab
- [ ] Tasks — **Expired tab** (new, Item 4)
- [ ] Assign task page (new, Item 8)
- [ ] Domain sheet (group → task selection)
- [ ] Create Custom Task page (new, Item 8)
- [ ] Reward picker / Mint a reward
- [ ] Create allowance (new, Item 10)
- [ ] Reward history
- [ ] Allowance history
- [ ] Grocery list
- [ ] Grocery aisle view
- [ ] Trophy ladder
- [ ] XP ledger
- [ ] House Rules — adult view
- [ ] Settings — root
- [ ] Settings — every sub-screen
- [ ] Members screen
- [ ] Member roster (onboarding)
- [ ] Champion's Record
- [ ] Notification settings

## §2.3 — Wheel pickers are the exception

**Task 2.3.a** — [ ] Wheel pickers (frequency, time, amount) cannot carry a bar. Use **top and bottom fade edges plus a fixed centre selection band** instead.

---

# §3 — ITEM 2: PER-MEMBER INVITES

## §3.1 — What changes

The QR code and invite link currently sit at **household** level. They move to **member** level. You tap a person, you get that person's code.

**Task 3.1.a** — [ ] **Delete the household-level QR and invite link entirely.** Not hidden, not deprecated — removed, along with any household-scoped invite token.

## §3.2 — The model

```ts
interface MemberInvite {
  id: string;
  householdId: string;
  memberId: string;          // WHO this invite is for
  token: string;             // ≥128 bits of entropy, URL-safe
  createdAt: string;
  expiresAt: string;         // createdAt + 7 days
  usedAt?: string;           // single-use — set on redemption
  revokedAt?: string;
  createdBy: string;         // admin id
}
```

**Rules — implement all four:**
- [ ] **Task 3.2.a** — Exactly **one active invite per member**. Generating a new one revokes the previous immediately.
- [ ] **Task 3.2.b** — **7-day expiry.** An expired token is rejected server-side with a clear message, never a generic error.
- [ ] **Task 3.2.c** — **Single-use.** Once redeemed, `usedAt` is set and the token is dead.
- [ ] **Task 3.2.d** — **Admins only** may generate, view, or revoke. Enforce server-side, not by hiding the button.

> **Why the expiry matters:** this token grants access to a child's account. A permanent code screenshotted into a family group chat is a standing back door.

## §3.3 — The surface

**Task 3.3.a** — [ ] Tapping a member on the Members screen opens their invite sheet:

```
┌────────────────────────────────────────┐
│  ‹ Members         MAYA                │
│                                        │
│        ┌──────────────────┐            │
│        │                  │            │
│        │    [ QR CODE ]   │            │
│        │                  │            │
│        └──────────────────┘            │
│                                        │
│   Scan this on Maya's device to add    │
│   her to the household.                │
│                                        │
│   ┌──────────────────────────────┐     │
│   │      Share invite link       │     │
│   └──────────────────────────────┘     │
│                                        │
│         Generate a new code            │
│                                        │
│   Expires in 7 days · works once       │
└────────────────────────────────────────┘
```

- [ ] **Task 3.3.b** — QR encodes the deep link containing the token. Nothing else.
- [ ] **Task 3.3.c** — `Share invite link` opens the native iOS share sheet.
- [ ] **Task 3.3.d** — `Generate a new code` revokes the old and issues a new one, with a confirm step: *"The old code will stop working."*
- [ ] **Task 3.3.e** — Expiry and single-use are stated on screen, always. Do not hide this in help text.

## §3.4 — Multiple devices

**Task 3.4.a** — [ ] A member may exist on **several devices at once**. Redeeming an invite adds their profile to that device; it does **not** remove them from any other.

**Task 3.4.b** — [ ] Shared devices (one tablet, several profiles) keep their existing profile-code switching. A member's invite works to add them to a shared device exactly as it does a personal one.

**Task 3.4.c** — [ ] A member already present on a device who scans their own invite gets: *"Maya is already on this device."* — not an error, and no duplicate profile.

---

# §4 — ITEM 3: HOLD & REQUEST

## §4.1 — Who sees the button

**Task 4.1.a** — [ ] `Hold & Request` is visible to **Helpers only**. An admin never sees it — they grant rewards directly. Do not render it disabled for admins; it does not exist for them.

## §4.2 — The gate

A Helper may request a reward **only when every task and every homework due today is complete.**

**Task 4.2.a** — [ ] Implement `canRequestReward(memberId): { allowed: boolean; remaining: {...} }`.

**Qualifying work — all of today's occurrences with these frequencies:**

| Frequency | Counts toward the gate |
|---|:---:|
| `daily` | ✅ |
| `weekdays` | ✅ |
| All homework due today | ✅ |
| `weekly`, `biweekly`, `monthly`, `quarterly` | ❌ |
| `seasonal`, `as_needed` | ❌ |

**Status treatment:**

| Occurrence status | Counts as done |
|---|:---:|
| `completed` (on time) | ✅ |
| `completed` (Late Credit) | ✅ |
| `pending` / `late` | ❌ |
| `expired` | ❌ |

- [ ] **Task 4.2.b** — Late completion counts. The child did the work.
- [ ] **Task 4.2.c** — An **expired** task blocks requests for the rest of that day. It cannot be completed, so the day cannot be finished. This is deliberate — state it in House Rules (§13).
- [ ] **Task 4.2.d** — A day with **nothing due** passes the gate vacuously. A child is not punished for a quiet day.

## §4.3 — What happens on request

```
Helper taps "Hold & Request"
            ↓
    canRequestReward()?
            ↓
    ┌───────┴────────┐
    NO               YES
    ↓                 ↓
 Blocked        approvalMode?
 message       ┌─────┴──────┐
            instant    requires_approval
               ↓             ↓
           GRANTED      Admin notified
           N07 sent      N26 sent
                             ↓
                     Grant / Not this time
                        N09  /  N10
```

- [ ] **Task 4.3.a** — Gate passes + `instant` → granted immediately, no admin involvement. Notification `N07`.
- [ ] **Task 4.3.b** — Gate passes + `requires_approval` → `RewardLedgerEntry` with `origin: 'requested'`, `status: 'pending'`. Admin gets `N26`.
- [ ] **Task 4.3.c** — Every request writes a ledger row via `applyRewardChange()` (Rev E §3.3). No exceptions.

## §4.4 — The blocked message

**Task 4.4.a** — [ ] Use this copy exactly, with live counts:

```
┌────────────────────────────────────────┐
│                                        │
│   Not just yet                         │
│                                        │
│   Finish today's tasks and homework    │
│   first.                               │
│                                        │
│   3 tasks left                         │
│   1 homework left                      │
│                                        │
│         [ See what's left ]            │
│                                        │
└────────────────────────────────────────┘
```

- [ ] **Task 4.4.b** — `See what's left` deep-links to the Tasks screen filtered to that member's outstanding work today.
- [ ] **Task 4.4.c** — Omit a line when its count is zero. Never render `0 homework left`.
- [ ] **Task 4.4.d** — Singular and plural handled: `1 task left`, not `1 tasks left`.
- [ ] **Task 4.4.e** — No red. No warning icon. No exclamation mark. This is a "not yet", not a telling-off.

## §4.5 — Rate limiting

**Task 4.5.a** — [ ] **A reward may be requested once per its own frequency period.** A `Daily` reward: once per day. `Weekly`: once per week. `Monthly`: once per month.

**Task 4.5.b** — [ ] An already-requested reward shows as `Asked for` and is not tappable until its period rolls over. Without this, a child can send twenty requests in an afternoon.

---

# §5 — ITEM 4: THE EXPIRED TAB

**🛑 §1 must be complete and verified before starting this.**

## §5.1 — Structure

**Task 5.1.a** — [ ] The Tasks screen gains three sections in this order:

```
   ┌──────────┬──────────────┬──────────┐
   │  Active  │  Completed   │ Expired  │
   └──────────┴──────────────┴──────────┘
```

- [ ] **Task 5.1.b** — `Expired` sits after `Completed`, never first, never adjacent to `Active`. A child opening their tasks should see what they can still do before what they missed.
- [ ] **Task 5.1.c** — Remove expired items from the `Active` list entirely. The screenshot shows them mixed in with live tasks, which is what made the list unreadable.

## §5.2 — Seven-day window

**Task 5.2.a** — [ ] The Expired tab shows only occurrences whose `expiredAt` is within the last **7 days**. Older ones drop out of view.

> ### ⚠️ HIDE THEM. DO NOT DELETE THEM.
>
> The Champion's Record needs lifetime expired counts, and the streak engine needs the history to compute rolling-7 windows. **Deleting these rows breaks both.**
>
> The 7 days is a **view filter**, not a purge.

- [ ] **Task 5.2.b** — Add `expiredAt: timestamp` to `task_occurrences`, set by the rollover job.
- [ ] **Task 5.2.c** — Verify Champion's Record expired counts are unaffected by the filter.

## §5.3 — Presentation

- [ ] **Task 5.3.a** — Group by day, newest first: `Yesterday`, `Monday`, `Sunday`.
- [ ] **Task 5.3.b** — Rows are **not interactive**. No checkbox, no Complete button, no tap target.
- [ ] **Task 5.3.c** — Muted styling. **No red.** Amber accent at most.
- [ ] **Task 5.3.d** — Empty state: `Nothing expired this week.`
- [ ] **Task 5.3.e** — Tab label carries a count only when non-zero: `Expired · 3`.

---

# §6 — ITEM 5: SHARE HOUSEHOLD INVITE

## §6.1 — Rename and promote

**Task 6.1.a** — [ ] `Open full members screen` → **`Share household invite`**.

**Task 6.1.b** — [ ] Promote it from a small text link to a **full-width filled button**, matching the primary button style used elsewhere. It is currently the least visible element on a screen where it is the main action.

## §6.2 — What it does

**Task 6.2.a** — [ ] It opens the **Members screen**, where the admin selects a person and gets **that person's** invite (§3).

> **Reconciling Items 2 and 5:** there is no household-wide invite token any more. This button is the *entry point* to per-member invites, not a household code. The label is the family's mental model — "share the invite" — while the mechanism underneath is per person, which is what Item 2 requires.

**Task 6.2.b** — [ ] Helper text beneath: `Pick who you're inviting.`

---

# §7 — ITEM 6: DARK-ON-DARK TEXT

## §7.1 — This is measured, not eyeballed

**Task 7.1.a** — [ ] Audit **every** text token against its background. Minimum ratios:

| Text | Minimum |
|---|---|
| Body and labels | **4.5:1** |
| Large text (18pt+, or 14pt bold) | **3:1** |
| Disabled or placeholder | **3:1** — legible, just quieter |

**Task 7.1.b** — [ ] Produce a table in your report: token name · hex · background hex · measured ratio · pass/fail. A visual pass is not acceptable — several of these are near-invisible and will be missed by eye.

## §7.2 — Known offenders. Fix these first.

From the submitted screenshots:

- [ ] Members screen — `Invite adult` section header
- [ ] Members screen — the description under `Invite adult`
- [ ] Members screen — `Invite kids (no sign-in)` header and description
- [ ] Members screen — `Add shared device` header and description
- [ ] Members sheet — `New shared device` description text
- [ ] Members sheet — `Tap a name to switch · Shared devices host Netflix-style profiles` helper line
- [ ] Members sheet — `Create an invite so they can join this household`
- [ ] Members screen — `Kid 1 name` / `Kid 2 name (optional)` placeholders
- [ ] Members screen — the disabled `Create kid invites` button label
- [ ] Achievements — achievement titles (from Rev B §8.3, still outstanding)
- [ ] Trophy ladder — locked trophy names and their `Locked · 100 XP` captions

## §7.3 — Fix at the token, not the component

**Task 7.3.a** — [ ] Correct the **theme tokens**. Do not patch individual components with one-off colours. If a token is too dark, every component using it is wrong, and patching one leaves the rest broken.

**Task 7.3.b** — [ ] Locked and disabled states dim the **icon or artwork**, never the text. A locked trophy stays readable; its badge goes quiet.

**Task 7.3.c** — [ ] Grep for raw hex colour values in components. Report the count. All should move to tokens.

---

# §8 — ITEM 7: FULL MEMBER CREATION

## §8.1 — Reuse the onboarding wizard

`Add new member` currently produces only a QR code and a link. It must run the **same wizard as first-run onboarding**.

**Task 8.1.a** — [ ] Wire `Add new member` to the existing Add-member wizard from Rev B §3.5:

```
Step A   Name (+ avatar colour, role: Admin / Helper)
Step B   Assign tasks          → the picker from Item 8
Step C   Rewards / allowance   → per the household's reward model
Step D   Review & Confirm
```

> ### ⚠️ DO NOT BUILD A SECOND WIZARD
>
> This is the **same component** as onboarding. If you find yourself writing a parallel implementation, stop — you are creating the exact divergence that caused the onboarding-rewards bug in Rev C §2.1.

**Task 8.1.b** — [ ] Step C follows `CAPABILITIES[household.rewardModel]`. On `xp_only` it is skipped entirely.

## §8.2 — The invite comes after

**Task 8.2.a** — [ ] On `Confirm creation`, the member is created **and their invite is generated** (§3). The confirmation screen offers `Show invite code` and `Add another member`.

**Task 8.2.b** — [ ] The invite is **never** the first step. A person exists first; the code connects them to a device afterwards.

---

# §9 — ITEM 8: TASK PAGE REBUILD

## §9.1 — Delete these three controls

- [ ] **Task 9.1.a** — Remove the **`Custom task`** button
- [ ] **Task 9.1.b** — Remove the **`Create a task`** button
- [ ] **Task 9.1.c** — Remove the **`Quick presets`** button

All three compete with the primary action and push it off the bottom of the screen.

## §9.2 — The (+) opens a dedicated Assign page

**Task 9.2.a** — [ ] `+` opens a **full page**, not a sheet stacked with everything else.

```
┌────────────────────────────────────────┐
│  ✕              Assigning to Maya      │  ← fixed header
├────────────────────────────────────────┤
│  ⌕  Search tasks…                      │
├────────────────────────────────────────┤
│                                        │
│   [Kitchen] [Trash]  [Bathroom] [Laundry]
│   [Bedroom] [Shared] [Floors]   [Pets] │  ← 14 tiles
│   [Car]     [Outdoors][Hygiene] [Routine]
│   [Groceries][Maintenance]             │
│                                        │
│   ┌──────────────────────────────┐     │
│   │     Create custom task       │     │  ← admins only
│   └──────────────────────────────┘     │
│                                        │
│         ⋮ (scrolls)                    │
├────────────────────────────────────────┤
│  Selected: 3 tasks              Clear  │  ← sticky
│  [Take out the garbage ×] [Recycling ×]│
│  ┌──────────────────────────────────┐  │
│  │      Assign 3 tasks · Maya       │  │  ← sticky, always visible
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

## §9.3 — The Assign button is sticky. This is the point of the item.

> ### ⚠️ THE ASSIGN BUTTON MUST NEVER SCROLL OFF SCREEN
>
> It is pinned to the bottom of the viewport, above the safe area, visible at every scroll position. A parent must never scroll to find the button that completes the thing they came to do.

- [ ] **Task 9.3.a** — Sticky footer containing the selected-chips tray and the Assign button.
- [ ] **Task 9.3.b** — Label interpolates live: `Assign 3 tasks · Maya`.
- [ ] **Task 9.3.c** — Disabled with zero selected, label `Pick some tasks`.
- [ ] **Task 9.3.d** — The assignee's name is in the **fixed header** as well as the button. Visible at all times, per the item.

## §9.4 — Create custom task is its own page

- [ ] **Task 9.4.a** — Opens as a separate page, not an inline expansion.
- [ ] **Task 9.4.b** — **Admins only.** Not rendered for Helpers.
- [ ] **Task 9.4.c** — Fields: **Name · Domain (required, one of 14) · Frequency · Due time · XP (5/10/15/20/25/30) · Require photo**. Nothing else. No priority. No room.
- [ ] **Task 9.4.d** — Saves to the **household task library** with `isCustom: true`, and appears in search and its domain sheet for every future assignment.
- [ ] **Task 9.4.e** — On save, returns to the Assign page with the new task **already selected**.

---

# §10 — ITEM 9: TASK ROWS AND DOMAIN NAMES

## §10.1 — Task rows show frequency

Task rows currently show XP only. They must show XP **and** an adjustable frequency.

**Task 10.1.a** — [ ] Render each task row as:

```
   ☐  Load the dishwasher
      10 XP  ·  Daily ▾
```

- [ ] **Task 10.1.b** — Frequency defaults to that task's `defaultFrequency` from the library.
- [ ] **Task 10.1.c** — Tapping `Daily ▾` opens the picker. Changing it affects **only that task, for this assignment**. It does not edit the library.
- [ ] **Task 10.1.d** — The chosen value writes to `TaskDefinition.recurrence` on assignment.

## §10.2 — The frequency picker: three plus More

**Task 10.2.a** — [ ] Show three directly, six behind `More`:

```
┌────────────────────────────┐
│  Daily      Weekly   Monthly │
│                              │
│  More ▾                      │
│  ├ Weekdays                  │
│  ├ Twice a week              │
│  ├ Every two weeks           │
│  ├ Quarterly                 │
│  ├ Seasonal                  │
│  └ As needed                 │
└────────────────────────────┘
```

- [ ] **Task 10.2.b** — `More` is collapsed by default and remembers its state within a session.
- [ ] **Task 10.2.c** — When a task's library default is one of the six, `More` opens expanded with that value selected — never hide the current value behind a collapsed row.
- [ ] **Task 10.2.d** — Display labels are as written above. Never show raw values like `2x_weekly`.

## §10.3 — Shortened domain names

Tiles currently truncate: `Floors & Deep Cleani…`, `Living Room & Shared S…`, `Meals, Groceries &…`, `Home Maintenance…`.

**Task 10.3.a** — [ ] Add `shortName` to the domain schema in `choremaxx-task-library.json`. Use `shortName` on tiles, `name` on sheet headers and everywhere else.

| Domain (`name`) | Tile (`shortName`) |
|---|---|
| Kitchen & Dining | **Kitchen** |
| Trash & Recycling | **Trash** |
| Bathroom | **Bathroom** |
| Laundry | **Laundry** |
| Bedroom | **Bedroom** |
| Living Room & Shared Spaces | **Shared Spaces** |
| Floors & Deep Cleaning | **Floors** |
| Pets | **Pets** |
| Car | **Car** |
| Yard & Outdoors | **Outdoors** |
| Personal Hygiene | **Hygiene** |
| Daily Routine | **Routine** |
| Homework & Education | **Homework** |
| Meals, Groceries & Errands | **Groceries** |
| Home Maintenance & Organization | **Maintenance** |

- [ ] **Task 10.3.b** — Every tile label renders **in full**, with no ellipsis, at default text size on a 390pt-wide device. Screenshot the grid as evidence.
- [ ] **Task 10.3.c** — Shortening the words is the fix. **Do not reduce the font size** — that trades one legibility problem for another.
- [ ] **Task 10.3.d** — `Homework` remains on the Homework tab only. It must not appear in the chores domain grid (Rev C §4.6).

---

# §11 — ITEM 10: NO XP COST, AND CREATE ALLOWANCE

## §11.1 — Delete the phrase

The Mint a reward screen reads:

> ❌ *"Add a catalogue reward with a frequency. No XP cost — rewards are granted for meeting chores."*

**Task 11.1.a** — [ ] Replace with exactly:

```
Add a catalogue reward with a frequency. Rewards are granted for
finishing chores.
```

**Task 11.1.b** — [ ] Grep for `XP cost`, `No XP cost`, `xpCost` across the whole app. All must return **0**. Rewards have not been purchasable with XP since Revision B §6.1; this string is a leftover advertising a rule that no longer exists.

## §11.2 — Create allowance

**Task 11.2.a** — [ ] Build a `Create allowance` screen that mirrors `Mint a reward` in structure and styling.

```
┌────────────────────────────────────────┐
│  Allowance                             │
│  Create an allowance                   │
│  Set an amount and how often it's      │
│  earned. ChoreMaxx keeps the record —  │
│  you hand over the money yourself.     │
│                                        │
│  Amount                                │
│  [ $ 5.00                           ]  │
│                                        │
│  How often                             │
│  [ Daily ] [ Weekly ] [ Monthly ]      │
│                                        │
│  Assign to                             │
│  ( Maya )  ( Liam )  ( Sofia )         │
│                                        │
│       [    Create allowance    ]       │
└────────────────────────────────────────┘
```

- [ ] **Task 11.2.b** — Frequency here is **Daily / Weekly / Monthly only**. No `More` row — allowance periods are not task frequencies.
- [ ] **Task 11.2.c** — The clarifier line is permanent. ChoreMaxx never moves money (Master Brief §3.9).

```ts
interface AllowanceRule {
  id: string;
  householdId: string;
  memberId: string;
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  active: boolean;
  createdAt: string;
}
```

## §11.3 — The completion bar

**Task 11.3.a** — [ ] Each allowance shows progress for its current period on the member's allowance card:

```
   Maya · $5.00 weekly
   ████████████░░░░░░░   17 of 24 tasks
   Earned when the week is finished
```

- [ ] **Task 11.3.b** — Progress = completed qualifying occurrences ÷ total qualifying occurrences in the current period.
- [ ] **Task 11.3.c** — Qualifying = the same set as the reward gate (§4.2): `daily`, `weekdays`, and homework. Not weekly or monthly chores.
- [ ] **Task 11.3.d** — Late completions **count as complete**. Consistent with §4.2.b.

## §11.4 — Payout is all-or-nothing

> ### ⚠️ 100% OR NOTHING. DO NOT PRO-RATE.
>
> At period close, **only** a 100% completion rate creates an `AllowanceLedgerEntry` with `status: 'owed'`. Anything less creates nothing.
>
> Do not invent partial payment. "Finish the week and it's yours" is a rule a seven-year-old can hold. "You get 71% of your allowance" is not.

- [ ] **Task 11.4.a** — Implement all-or-nothing at period close.
- [ ] **Task 11.4.b** — Period boundaries are **household-local** and match `WEEK_STARTS_ON` (Rev D §1.1): weeks run Monday 00:00 → Sunday 23:59:59.
- [ ] **Task 11.4.c** — On a missed period, the bar resets and shows `Not earned this week` for one day before starting over.
- [ ] **Task 11.4.d** — An `owed` entry appears in the Allowance tab for an admin to `Mark as paid` (Rev E §4.1). It is never marked paid automatically.
- [ ] **Task 11.4.e** — Every allowance state change routes through `applyAllowanceChange()` (Rev E §3.3).

---

# §12 — ITEM 11: WHO CAN DO WHAT

## §12.1 — Only the assignee completes a task

**Task 12.1.a** — [ ] The Complete action is available **only to the person the task is assigned to.** An admin cannot tick off another person's task.

- [ ] **Task 12.1.b** — Enforce **server-side**. An admin calling the complete endpoint for another member's occurrence must be rejected.
- [ ] **Task 12.1.c** — On an admin's view of someone else's task, the checkbox is **absent**, not disabled.

> ### ⚠️ THIS DOES NOT REMOVE ANY OTHER ADMIN POWER
>
> The proof and confirmation system from Revision C stays **entirely intact**. Admins still request proof, confirm homework, mark not done, and reverse XP. The single thing they cannot do is tap Complete on someone else's behalf.

## §12.2 — Unassign before completion

**Task 12.2.a** — [ ] Admins may **unassign or remove** a task while its status is `pending` or `late`.

| Status | Can admin unassign? |
|---|:---:|
| `pending` | ✅ Yes |
| `late` | ✅ Yes |
| `completed` | ❌ No — use `Mark not done` |
| `expired` | ❌ No |

- [ ] **Task 12.2.b** — Unassigning deletes the occurrence and awards nothing. It is not a reversal and writes no XP ledger entry.
- [ ] **Task 12.2.c** — Unassigning removes it from the streak denominator for that day. A task the child was never given cannot count against them.
- [ ] **Task 12.2.d** — Offer `Remove for today` vs `Remove permanently` — the second deactivates the underlying `TaskDefinition` so it stops recurring.
- [ ] **Task 12.2.e** — Notify the member: `Mum removed Clean the toilet from today.`

## §12.3 — Amended permission matrix

**Task 12.3.a** — [ ] Update Rev C §1.6 to this. It is now authoritative.

| Action | Admin | Helper |
|---|:---:|:---:|
| Assign a task | ✅ | ❌ |
| Unassign / remove an **incomplete** task | ✅ | ❌ |
| **Complete a task** | **own only** | **own only** |
| Request proof | ✅ | ❌ |
| Confirm a completion | ✅ | ❌ |
| Mark not done (reverse XP) | ✅ | ❌ |
| Grant or decline a reward | ✅ | ❌ |
| **Hold & Request a reward** | ❌ | ✅ |
| Create / edit rewards and allowances | ✅ | ❌ |
| Mark allowance paid | ✅ | ❌ |
| Generate or revoke invites | ✅ | ❌ |
| Create custom tasks | ✅ | ❌ |
| Add or remove members | ✅ | ❌ |
| Set Recess | ✅ | ❌ |
| Submit photo proof | own only | own only |
| View own record and ledger | ✅ | ✅ |

---

# §13 — HOUSE RULES ADDITIONS

Four items change the rules a family lives by. Add these to `house-rules.json`.

**Task 13.a** — [ ] Add all four entries. Follow the existing schema exactly — `id`, `chapter`, `appliesWhen`, `adultText`, `kidText`, `order`.

### R30 — chapter: `rewards`

```
adult: A Helper can ask for a reward once their tasks and homework
       for the day are done. Rewards set to grant instantly are given
       straight away — the rest come to you to approve.

kid:   Finish today's tasks and homework, then you can ask for a reward.
```

### R31 — chapter: `rewards` · `appliesWhen`: allowance enabled

```
adult: Allowance is earned by finishing every task in the period —
       daily, weekly or monthly. A progress bar shows how close they
       are. Nothing partial is paid.

kid:   Finish everything this week and your allowance is yours.
```

### R32 — chapter: `deadlines`

```
adult: Expired tasks move to their own tab and stay there for seven
       days, then clear from view.

kid:   Missed tasks sit in the Expired tab for a week.
```

### R33 — chapter: `household`

```
adult: Only the person a task belongs to can tick it off. You can
       unassign a task any time before it's done.

kid:   Only you can tick off your own tasks.
```

**Task 13.b** — [ ] Confirm the Kid view still fits **one screen with no scrolling** after these additions (Rev D §4.3). If it no longer does, **report it** — do not shrink the type and do not add a scroll.

---

# §14 — TESTS AND COMPLETION REPORT

## §14.1 — Tests

```
PREREQUISITE
[ ] F1.1–F1.5  (see §1.3 — all five must pass before Item 4)

ITEM 1 · SCROLL
[ ] F2.1  All 21 surfaces show a persistent right-edge indicator
[ ] F2.2  Indicator hidden when content fits (no empty track)
[ ] F2.3  Wheel pickers show fade edges + centre band
[ ] F2.4  Screenshot attached for every surface

ITEM 2 · INVITES
[ ] F3.1  Household-level QR and token fully removed
[ ] F3.2  Each member has their own QR and link
[ ] F3.3  Token expires at 7 days → clear rejection message
[ ] F3.4  Token is single-use → second redemption rejected
[ ] F3.5  Regenerating revokes the previous token immediately
[ ] F3.6  Helper cannot generate an invite via direct API call
[ ] F3.7  Same member added to two devices, present on both
[ ] F3.8  Scanning own invite on a device already holding you
          → friendly message, no duplicate profile

ITEM 3 · HOLD & REQUEST
[ ] F4.1  Button not rendered for admins
[ ] F4.2  Tasks outstanding → blocked, correct live counts
[ ] F4.3  All done → instant reward granted with no admin step
[ ] F4.4  All done → requires_approval reward notifies admin (N26)
[ ] F4.5  A LATE completion counts toward the gate
[ ] F4.6  An EXPIRED task blocks requests for the rest of the day
[ ] F4.7  Nothing due today → gate passes
[ ] F4.8  Same daily reward twice in one day → second blocked
[ ] F4.9  Every request writes a RewardLedgerEntry

ITEM 4 · EXPIRED TAB
[ ] F5.1  Three tabs, Expired positioned last
[ ] F5.2  Expired items absent from the Active list
[ ] F5.3  Item expired 8 days ago → hidden from tab
[ ] F5.4  ...but its row still EXISTS in the database
[ ] F5.5  Champion's Record expired count unaffected by the filter
[ ] F5.6  Expired rows are not interactive

ITEM 5 · SHARE INVITE
[ ] F6.1  "Open full members screen" → 0 grep results
[ ] F6.2  Rendered as a full-width filled button

ITEM 6 · CONTRAST
[ ] F7.1  All 11 named offenders pass 4.5:1 (report measured values)
[ ] F7.2  Full token audit table produced
[ ] F7.3  Raw hex values in components → report count

ITEM 7 · MEMBER CREATION
[ ] F8.1  Add new member runs the full 4-step wizard
[ ] F8.2  It is the SAME component as onboarding (one implementation)
[ ] F8.3  xp_only household → Step C skipped
[ ] F8.4  Invite generated on confirm, offered after creation

ITEM 8 · TASK PAGE
[ ] F9.1  Custom task / Create a task / Quick presets → all removed
[ ] F9.2  Assign button visible at EVERY scroll position
[ ] F9.3  Label reads "Assign 3 tasks · Maya"
[ ] F9.4  Zero selected → disabled, "Pick some tasks"
[ ] F9.5  Create custom task is its own page, admins only
[ ] F9.6  Saving a custom task returns with it pre-selected

ITEM 9 · TASK ROWS
[ ] F10.1 Rows show XP and an adjustable frequency
[ ] F10.2 Changing frequency does NOT edit the library
[ ] F10.3 Picker shows 3 + More with 6 behind it
[ ] F10.4 Library default of 2x_weekly → More opens expanded
[ ] F10.5 All 14 tiles render in full, no ellipsis (screenshot)
[ ] F10.6 Font size unchanged from before

ITEM 10 · ALLOWANCE
[ ] F11.1 "No XP cost" and "xpCost" → 0 grep results
[ ] F11.2 Create allowance produces an AllowanceRule
[ ] F11.3 Completion bar reflects true progress
[ ] F11.4 100% at period close → 'owed' entry created
[ ] F11.5 99% at period close → NOTHING created
[ ] F11.6 Late completions count toward the bar
[ ] F11.7 'owed' never auto-marks as paid

ITEM 11 · PERMISSIONS
[ ] F12.1 Admin cannot complete another member's task (API-level)
[ ] F12.2 Checkbox ABSENT, not disabled, on others' tasks
[ ] F12.3 Admin CAN still request proof, confirm, mark not done
[ ] F12.4 Unassign works on pending and late
[ ] F12.5 Unassign REJECTED on completed and expired
[ ] F12.6 Unassigned task leaves the streak denominator

HOUSE RULES
[ ] F13.1 R30–R33 present in house-rules.json
[ ] F13.2 R31 hidden when allowance is disabled
[ ] F13.3 Kid view still fits one screen (screenshot)
```

## §14.2 — Completion report

```
CHOREMAXX REVISION F — COMPLETION REPORT

PREREQUISITE
  §1 duplicate-occurrence bug .......... [ DONE / PARTIAL / NOT STARTED ]
  Unique constraint applied ............ [ Y / N ]
  Duplicate rows deleted ............... ____
  XP reconciled ........................ ____

ITEMS
   1 Scroll indicators ....... [ DONE / PARTIAL / NOT STARTED ]
   2 Per-member invites ...... [ DONE / PARTIAL / NOT STARTED ]
   3 Hold & Request .......... [ DONE / PARTIAL / NOT STARTED ]
   4 Expired tab ............. [ DONE / PARTIAL / NOT STARTED ]
   5 Share household invite .. [ DONE / PARTIAL / NOT STARTED ]
   6 Dark-on-dark text ....... [ DONE / PARTIAL / NOT STARTED ]
   7 Member creation ......... [ DONE / PARTIAL / NOT STARTED ]
   8 Task page rebuild ....... [ DONE / PARTIAL / NOT STARTED ]
   9 Task rows & domains ..... [ DONE / PARTIAL / NOT STARTED ]
  10 Allowance ............... [ DONE / PARTIAL / NOT STARTED ]
  11 Permissions ............. [ DONE / PARTIAL / NOT STARTED ]
  13 House Rules ............. [ DONE / PARTIAL / NOT STARTED ]

TESTS
  Prerequisite ....... __ / 5      Item 6 ........ __ / 3
  Item 1 ............. __ / 4      Item 7 ........ __ / 4
  Item 2 ............. __ / 8      Item 8 ........ __ / 6
  Item 3 ............. __ / 9      Item 9 ........ __ / 6
  Item 4 ............. __ / 6      Item 10 ....... __ / 7
  Item 5 ............. __ / 2      Item 11 ....... __ / 6
  House Rules ........ __ / 3

  Every failure, by ID, with reason:
  →

GREP — all must be 0
  "Open full members screen" ......... __
  "No XP cost" / "xpCost" ............ __
  "Quick presets" .................... __
  Household-level invite token ....... __
  Raw hex in components .............. __

CONTRAST AUDIT
  Token | hex | background | ratio | pass
  → (full table required)

SCREENSHOTS ATTACHED
  21 scroll surfaces ................. [ Y / N ]
  Domain tile grid, no ellipsis ...... [ Y / N ]
  Kid House Rules, one screen ........ [ Y / N ]

ANYTHING SKIPPED, DEFERRED, OR ASSUMED:
  →

FEATURES BUILT THAT WERE NOT IN A DOCUMENT:
  → (should be "none")

QUESTIONS I SHOULD HAVE ASKED:
  →
```

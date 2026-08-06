# ChoreMaxx — Revision E
## Intro Slogans · Notification Copy · History Bug · Vocabulary Audit

**Read this entire document before writing a single line of code.**

---

# ⛔ EXECUTION PROTOCOL

```
RULES OF ENGAGEMENT

1. §0 contains QUESTIONS. Some are already answered.
   Any marked "ASK BEFORE BUILDING" must be answered by the
   product owner first. STOP and ask. Do not guess.

2. Work items in order: §1 → §2 → §3 → §4.
   §3 is a live data-loss bug. If you only have time for one
   thing, do §3.

3. Every task has a checkbox. Do not tick a box you have not done.

4. This is a COPY AND DATA-INTEGRITY revision. You are replacing
   strings and fixing a broken read path. You are NOT redesigning
   layouts, NOT adding features, NOT changing any game mechanic.

5. Where this document gives exact copy in a code block, use it
   VERBATIM. Do not paraphrase. Do not "improve" it. Do not add
   exclamation marks or emoji.

6. Fill in the COMPLETION REPORT (§7). It is not optional.
```

### Companion documents — all still in force

| Document | Status |
|---|---|
| `choremaxx-v2-cursor-spec.md` (Revision B) | In force |
| `choremaxx-revision-c-spec.md` (Revision C) | In force |
| `choremaxx-revision-d-spec.md` (Revision D) | In force |
| `choremaxx-task-library.json` | In force |
| `choremaxx-grocery-categories.json` | In force |

**Nothing in Revision D changes.** Late Credit, Expiry, Streak Rescue, Recess, Crowns and House Rules all stand exactly as written. This document changes wording and fixes a bug.

---

# §0 — QUESTIONS

## §0.1 — 🔴 ASK BEFORE BUILDING

> ### QUESTION 1 — Does a "reward request" feature exist on purpose?
>
> A notification currently in the app reads:
>
> > *"Ci requested Additional screen time. Approve when it feels fair."*
>
> And the Reward tally screen describes itself as:
>
> > *"Pending, approved, and rejected asks — with origin so admins know mint vs special request."*
>
> **This implies children can REQUEST rewards, and can send "special requests" for rewards that don't exist yet.** No approved specification contains this. Revisions B, C and D describe rewards as **earned** by completing assigned work, then either granted instantly or held for admin approval. There is no request flow anywhere in those documents.
>
> **Three possibilities:**
>
> | | Interpretation | What to do |
> |---|---|---|
> | **A** | It was invented without instruction | **Remove it entirely.** Rewards are earned, never requested. |
> | **B** | It is wanted and should stay | Keep it, and it must be specified properly — who can request, how often, what stops a child requesting twenty times a day |
> | **C** | It is a mislabelled version of the approval flow | Rename it. A reward *earned* and awaiting approval is not a *request*. |
>
> **DO NOT PROCEED past §2 without an answer.** The notification copy in §2 depends entirely on which of these is true. Placeholder copy is provided for both A and B, clearly marked.

## §0.2 — Already answered. Do not ask again.

| # | Question | **Answer** |
|---|---|---|
| Q2 | Does ChoreMaxx ever move real money? | **NO. Never.** It is a tracker. A parent hands over cash, e-transfer, or whatever they normally use, then records it in the app. Every string must reflect this. See §4.1. |
| Q3 | Is "Mint" acceptable vocabulary? | **Yes, but only as a verb on the create action** — `Mint a reward`. Never as a noun or a category (`mint vs special request` is wrong). See §4.3. |
| Q4 | Should the three intro slogans be replaced? | **Yes, all three.** Slogan 3 in particular is rejected outright. See §1. |

---

# §1 — INTRO SLOGANS

## §1.1 — What is being replaced

The app intro carries three sliding slogans. **All three are replaced.**

| # | Current | Verdict |
|---|---|---|
| 1 | *Poppins co managed the home.* | Replace. Grammatically broken — wrong tense, missing hyphen. |
| 2 | *Built for real households.* | Replace. Serviceable but flat; "households" is a census word, not a warm one. |
| 3 | *Zero clutter. Quiet Rhythm.* | **Replace outright.** Describes an aesthetic, not a benefit. Tells a parent nothing about what the app does for them. |

## §1.2 — The replacement set

**Use these three, in this order.** They are written as a sequence: who it's for → what changes → who helps.

```
SLIDE 1
Built for real families with high standards.

SLIDE 2
Everyone knows what's theirs to do.

SLIDE 3
Poppins keeps the whole house in step.
```

**Task 1.2.a** — [ ] Replace all three slogans with the exact text above. Preserve slide order.

**Task 1.2.b** — [ ] Store them in `src/constants/vocabulary.ts` (created in Revision D §0.3.a) as `INTRO_SLOGANS`. No component holds a hardcoded slogan.

**Task 1.2.c** — [ ] Verify each fits on **two lines maximum** at default text size on a 390pt-wide device. If any wraps to three lines, report it — do not shrink the font.

**Task 1.2.d** — [ ] Sentence case with a full stop, exactly as written. Do **not** title-case. Do **not** capitalise "Perfect", "Theirs", or "House".

## §1.3 — Alternates (product owner may swap in any full set)

These are complete sets. **Do not mix across sets without asking** — each is written as an arc.

**Set B — warmer**
```
Every home has a rhythm. This one keeps it.
Chores, shared fairly. The rest sorts itself.
Poppins helps you run the place.
```

**Set C — more formal**
```
A household runs on more than good intentions.
Everyone knows their part.
Poppins keeps it all in step.
```

**Set D — plainest**
```
The chores, sorted.
Everyone knows what they owe the house.
Poppins does the remembering.
```

---

# §2 — NOTIFICATION COPY

## §2.1 — The problem

The notifications currently in the app were not specified and several are poor. The reference case:

> **❌ `"Ci requested Additional screen time. Approve when it feels fair."`**

Three separate faults in one banner:

1. **"Approve when it feels fair"** instructs a parent how to feel about their own decision. A notification reports; it does not counsel.
2. **"Additional screen time"** is mid-sentence but capitalised, because a data field was dropped into prose without casing it.
3. The whole second sentence is filler. Delete it and nothing is lost.

## §2.2 — Copy rules. Apply to every notification without exception.

| ✅ Always | ❌ Never |
|---|---|
| Name the person: `Maya`, `Dad` | Say `A user` or `Someone` |
| State what happened, then stop | Advise how to feel or what to decide |
| Sentence case in the body | Capitalise a data value mid-sentence |
| Under 12 words in the body | Write two sentences where one works |
| Plain full stops | Exclamation marks — **zero, anywhere** |
| Household-local times, 12-hour with AM/PM | 24-hour or UTC times |
| The child's display name | A username, handle, or ID |
| | Emoji in title or body |
| | Internal vocabulary (`mint`, `origin`, `ledger`, `occurrence`) |

**Task 2.2.a** — [ ] Add these rules as a comment header in the notification copy file so the next person doesn't reintroduce the same faults.

## §2.3 — The registry. This list is CLOSED.

**Task 2.3.a** — [ ] Create `src/constants/notifications.ts`. Every notification in the app is defined here and nowhere else.

> ### ⚠️ THIS IS A CLOSED LIST
>
> **Audit every notification the app can currently send.** If it is not in the table below, **delete it**. Do not keep an unlisted notification because it "seems useful." Report anything you deleted in §7.

### To a Helper (child)

| ID | Trigger | Title | Body |
|---|---|---|---|
| `N01` | 30 min before deadline, 2+ tasks | Poppins | `3 tasks due at 7:00 PM.` |
| `N02` | 30 min before deadline, 1 task | Poppins | `Tidy your room is due at 7:00 PM.` |
| `N03` | Proof requested on a chore | Poppins · Photo | `Mum asked for a photo of the kitchen counters.` |
| `N04` | Streak at risk at rollover | Poppins · Streak | `Your 12-day streak is at risk.` |
| `N05` | Streak Rescue accepted | Poppins · Streak | `Your 12-day streak is safe.` |
| `N06` | Streak ended | Poppins · Streak | `Your streak ended at 12 days.` |
| `N07` | Reward granted instantly | Poppins · Reward | `You earned Additional screen time.` |
| `N08` | Reward earned, awaiting approval | Poppins · Reward | `Additional screen time is ready. Waiting on a grown-up.` |
| `N09` | Reward approved by admin | Poppins · Reward | `Dad approved Additional screen time.` |
| `N10` | Reward declined by admin | Poppins · Reward | `Dad said not this time for Additional screen time.` |
| `N11` | Completion reversed by admin | Poppins · Tasks | `Mum marked Clean the toilet as not done yet.` |
| `N12` | Trophy unlocked | Poppins · Trophy | `Trophy unlocked: Thousand Club.` |
| `N13` | Crown won | Poppins · Crown | `You took the Week's Crown.` |
| `N14` | Allowance marked paid | Poppins · Allowance | `Your $5 allowance is marked paid.` |
| `N15` | Recess started | Poppins · Recess | `You're on recess. Your 12-day streak is safe.` |
| `N16` | Recess ended | Poppins · Recess | `Recess is over. Tasks start again tomorrow.` |

### To an Admin

| ID | Trigger | Title | Body |
|---|---|---|---|
| `N17` | Tasks completed, batched 5 min, 2+ | Poppins · Tasks | `Maya completed 3 tasks. +25 XP.` |
| `N18` | Task completed, single | Poppins · Tasks | `Maya completed Load the dishwasher. +10 XP.` |
| `N19` | Homework submitted for checking | Poppins · Homework | `Maya's homework is ready to check.` |
| `N20` | Photo proof submitted | Poppins · Photo | `Maya sent a photo of the kitchen counters.` |
| `N21` | Reward earned, needs approval | Poppins · Reward | `Maya earned Choose dinner. Ready to approve.` |
| `N22` | Allowance due | Poppins · Allowance | `Allowance is ready to approve for 2 people.` |
| `N23` | A child's streak at risk | Poppins · Streak | `Maya's 12-day streak is at risk.` |
| `N24` | Crown result at period close | Poppins · Crown | `Maya took the Week's Crown.` |
| `N25` | Household setup incomplete | Poppins · Setup | `2 people still need tasks.` |

### Conditional on QUESTION 1 (§0.1)

**If the answer is A (remove the request feature):** delete `N26` and `N27` and any code that sends them.

**If the answer is B (keep it):**

| ID | Trigger | Title | Body |
|---|---|---|---|
| `N26` | Child requests an existing reward | Poppins · Reward | `Maya asked for Additional screen time.` |
| `N27` | Child requests something new | Poppins · Reward | `Maya asked for something new: a later bedtime.` |

**Task 2.3.b** — [ ] Note that `N26` is the corrected form of the faulty banner. The entire second sentence — *"Approve when it feels fair."* — is **deleted**, not rewritten.

## §2.4 — Interpolation

**Task 2.4.a** — [ ] Every bracketed value below is interpolated at send time. **Lower-case any data value that lands mid-sentence** unless it is a proper noun.

```
✅  "Maya asked for additional screen time."
❌  "Maya asked for Additional screen time."
```

Reward names, task names and domain names are **not** proper nouns. Only people's names are.

**Task 2.4.b** — [ ] Write `toSentenceValue(str)` and route every interpolated value through it. Do not solve this by editing the seed data — the seed casing is correct for buttons and lists, and only wrong inside a sentence.

## §2.5 — Delivery rules (unchanged from Revision D §5.1)

- [ ] **Task 2.5.a** — Batch by `(memberId, dueAt)`. Five tasks at 19:00 = **one** notification (`N01`), never five.
- [ ] **Task 2.5.b** — Batch admin completion notices in 5-minute windows (`N17`).
- [ ] **Task 2.5.c** — Quiet hours **21:00–07:00** household-local. Queue everything except deadline reminders to 07:00.
- [ ] **Task 2.5.d** — Never send anything to a member on Recess.
- [ ] **Task 2.5.e** — Shared device: prefix with the person — `Maya: 3 tasks due at 7:00 PM.`
- [ ] **Task 2.5.f** — Every category individually toggleable in Settings → Notifications.

---

# §3 — 🔴 THE HISTORY BUG

## §3.1 — What is broken

**Reported:** rewards were approved and allowance was approved. Both history screens show **zero**.

**Reward tally screen:** `Pending 0 · Approved 0 · Total 0`, with the empty state *"No redemptions yet."* still showing.

**Allowance screen:** `Unpaid 0 · Approved 0 · Pending 0`, with a member card reading `0-day streak · 0 pending`.

**This is the same class of defect as the onboarding-rewards bug in Revision C §2.1** — an action mutates one place and the screen reads another. The pattern has now recurred twice. Fix the pattern, not just the symptom.

## §3.2 — Diagnose in this exact order. Report findings before fixing.

**Task 3.2.a** — [ ] Work through these five and **report which one it is**. Do not start writing code until you know.

| # | Check | How |
|---|---|---|
| **1** | Does approval write a history row **at all**, or only flip a status field in place? | Approve one reward, then query the history table directly |
| **2** | Does the write use a status value the read query doesn't match? | Compare written value against the query's `WHERE` — check `'approved'` vs `'APPROVED'` vs `'granted'` |
| **3** | Is the period filter excluding the row? | "This Week's" — check the date field is populated, and that the boundary uses **household-local** time, not UTC or device time |
| **4** | Is the query scoped to the wrong `householdId` or `memberId`? | Log the actual parameters at call time |
| **5** | Is the write optimistic-only — local state that never reached the server? | Approve, force-quit, relaunch, re-query |

> **Most likely: #1 or #3.** A `0` in every single column, plus an empty state that still renders, points to the query returning an empty set rather than a wrong set. #3 is especially likely because the screen is scoped to "This Week's" and a UTC/local mismatch silently drops rows for hours either side of a boundary.

## §3.3 — The required end state

Both ledgers follow the pattern established for XP in Revision D §1.6: **one write function, one table, one read path.**

**Task 3.3.a** — [ ] Create the reward ledger.

```ts
interface RewardLedgerEntry {
  id: string;
  householdId: string;
  memberId: string;
  rewardId: string;
  rewardName: string;        // SNAPSHOT — survives the reward being renamed or deleted
  origin: 'earned' | 'requested';
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;         // ISO UTC
  resolvedAt?: string;
  resolvedBy?: string;       // admin id
  note?: string;
}
```

**Task 3.3.b** — [ ] Create the allowance ledger.

```ts
interface AllowanceLedgerEntry {
  id: string;
  householdId: string;
  memberId: string;
  amount: number;
  currency: string;
  status: 'owed' | 'paid';
  periodStart: string;       // 'YYYY-MM-DD' household-local
  periodEnd: string;
  createdAt: string;
  markedPaidAt?: string;
  markedPaidBy?: string;     // admin id
  note?: string;
}
```

**Task 3.3.c** — [ ] Route **every** reward mutation through a single `applyRewardChange()` and **every** allowance mutation through a single `applyAllowanceChange()`. Both always insert a ledger row. There must be no code path that changes a reward or allowance state without writing history.

**Task 3.3.d** — [ ] Both history screens read **only** from these tables. Delete any parallel store, any derived-on-the-fly computation, and any cached counter.

**Task 3.3.e** — [ ] `rewardName` and `amount` are **snapshots**. A reward renamed or deleted next month must not alter what history says happened.

## §3.4 — Period boundaries

> ### ⚠️ THIS IS THE MOST LIKELY ROOT CAUSE. GET IT RIGHT.

**Task 3.4.a** — [ ] Every "this week" filter uses **household-local** time, from `household.timezone`. Never the device timezone. Never UTC.

**Task 3.4.b** — [ ] The week runs **Monday 00:00:00 → Sunday 23:59:59 household-local**, matching `WEEK_STARTS_ON` in Revision D §1.1. Convert to UTC only at the moment of querying.

**Task 3.4.c** — [ ] Add a test: approve an allowance at **23:30 on a Sunday** in a household on `America/Toronto`. It must appear in that week, not the next.

## §3.5 — The stat rows

The current stats are wrong on both screens — not just empty, but the wrong labels for the wrong states.

### Reward screen

```
❌  Pending 0 · Approved 0 · Total 0
✅  Waiting 3 · Approved 12 · Declined 1
```

- [ ] **Task 3.5.a** — `Total` is meaningless next to two of its own components. Replace with `Declined`.
- [ ] **Task 3.5.b** — `Pending` → `Waiting`. Warmer, and it reads as a state rather than a queue.
- [ ] **Task 3.5.c** — These three cover every possible status with no overlap. Verify they always sum to the row count.

### Allowance screen

```
❌  Unpaid 0 · Approved 0 · Pending 0
✅  Owed $15 · Paid this week $20
```

- [ ] **Task 3.5.d** — Three overlapping words for what is really two states. Reduce to **Owed** and **Paid**.
- [ ] **Task 3.5.e** — Show **currency amounts**, not counts. A parent wants to know they owe $15, not that they owe "2".

## §3.6 — Empty states

**Task 3.6.a** — [ ] The empty state must be driven by the **same query** that populates the list. The reported bug showed *"No redemptions yet"* while records existed, which means the empty state has its own broken condition. One query, one source of truth.

**Task 3.6.b** — [ ] Replace the empty copy:

```
❌  "No redemptions yet"
    "Redeem from the shop or send a special request."

✅  "Nothing here yet."
    "Approved rewards will show up here."
```

There is no "shop" in this app. That string is describing a feature that does not exist.

## §3.7 — Backfill

**Task 3.7.a** — [ ] Reconstruct ledger rows from whatever historical state exists. Where an approval cannot be reconstructed, write nothing rather than guessing — an invented history is worse than a short one. Report how many rows you recovered and how many were unrecoverable.

---

# §4 — VOCABULARY AUDIT

## §4.1 — 🔴 ChoreMaxx does not move money

> ### THIS IS THE MOST IMPORTANT CHANGE IN THIS DOCUMENT
>
> **ChoreMaxx never transfers funds.** It is a record-keeper. A parent hands over cash, e-transfer, or whatever they normally use — outside the app — and then **records** it here.
>
> Every string implying otherwise must go. `Send Allowance` tells a parent the app is about to move $5. It is not. Beyond being confusing, claiming to send money you are not sending is a genuine problem for an app in review.

**Task 4.1.a** — [ ] Make every replacement below. These are exact.

| ❌ Current | ✅ Replacement | Where |
|---|---|---|
| `Send Allowance` | **`Mark as paid`** | Allowance member card |
| `Pay Now` | **`Mark as paid`** | Anywhere it survives |
| `This Week's Allowance` | **`This week`** | Allowance header |
| `Unpaid` | **`Owed`** | Allowance stat |
| `Approved` / `Pending` (allowance) | **`Paid`** — one stat, not two | Allowance stat |
| `Manual Send always works.` | See §4.2 | House Rules |
| `payroll` | Must not appear anywhere | Global |

**Task 4.1.b** — [ ] Add a one-line clarifier beneath the allowance header, shown always:

```
ChoreMaxx keeps the record. You hand over the money however you normally do.
```

**Task 4.1.c** — [ ] Grep for `send`, `pay`, `transfer`, `deposit` in every allowance-related string. Report each one and how you resolved it.

## §4.2 — The House Rules line

Currently reads, with no context whatsoever:

> ❌ *"Allowance can be sent on the household schedule. Manual Send always works."*

**Task 4.2.a** — [ ] Replace the `rewards` registry entry (Revision D §4.1) with exactly this:

**Adult text:**
```
ChoreMaxx tracks allowance — it never moves money. Allowance builds up
on the household schedule, and an admin marks it paid once they've handed
it over. An admin can mark allowance paid at any time.
```

**Kid text:**
```
Your allowance adds up here. A grown-up gives it to you and ticks it off.
```

**Task 4.2.b** — [ ] Audit **every** House Rules registry entry for the same fault — a sentence that assumes context the reader doesn't have. `Manual Send always works` failed because it referenced a button by name without saying what it does or why you'd use it. Report every entry you rewrote.

## §4.3 — The Reward tally screen

Currently:

> ❌ **Eyebrow:** `Redeem ledger`
> ❌ **Title:** `Reward tally`
> ❌ **Description:** `Pending, approved, and rejected asks — with origin so admins know mint vs special request.`

Every one of these is internal engineering vocabulary shown to a parent. `ledger`, `tally`, `origin`, `asks`, and `mint vs special request` are all words from the implementation, not the family's world.

**Task 4.3.a** — [ ] Replace with exactly:

```
Eyebrow:      REWARDS
Title:        Reward history
Description:  Every reward your family has earned, and what you decided.
```

**Task 4.3.b** — [ ] `mint` survives **only** as a verb on the create action — `Mint a reward`. It must never appear as a noun, a category, a filter, or a description. Grep and confirm.

**Task 4.3.c** — [ ] `origin` is an internal field name. If the distinction between earned and requested needs surfacing, it is a badge on the row reading `Earned` or `Asked for` — never the word "origin".

## §4.4 — Global sweep

**Task 4.4.a** — [ ] These words must not appear in **any** user-facing string. Grep each, report the count. All must be zero.

| Banned | Why | Use instead |
|---|---|---|
| `ledger` | Accounting jargon | `history` |
| `tally` | Same | `history` or nothing |
| `origin` | Database field name | `Earned` / `Asked for` |
| `asks` (noun) | Reads as jargon | `requests` |
| `occurrence` | Internal model name | `task` |
| `payroll` | These are children | `allowance` |
| `redemption` | Retired in Revision D | `Streak Rescue`, or `reward` |
| `shop` | No such feature exists | — |
| `user` | Cold | the person's name, or `family member` |
| `Nova` | Renamed in Revision B | `Poppins` |
| `roommate` | Removed in Revision B | — |
| `Member` (as a role label) | Renamed in Revision C | `Helper` |

**Task 4.4.b** — [ ] Where an internal term is genuinely needed in code, keep it in code. This sweep covers **user-facing strings only**. Do not rename database columns.

## §4.5 — The tone test

**Task 4.5.a** — [ ] Read every string you touched against this. Rewrite any that fails.

```
Would a thoughtful parent write this sentence
to their own child?

If it sounds like a database, a bank, or a
compliance form — rewrite it.
```

---

# §5 — SCREENS AFFECTED

Tick only what you have built and opened.

- [ ] App intro, all three slides with new slogans
- [ ] Reward history screen — populated state
- [ ] Reward history screen — empty state, new copy
- [ ] Reward history — stat row reading `Waiting / Approved / Declined`
- [ ] Allowance screen — populated, with currency amounts
- [ ] Allowance screen — empty state
- [ ] Allowance screen — `Mark as paid` button
- [ ] Allowance screen — clarifier line beneath the header
- [ ] House Rules → adult view, corrected allowance entry
- [ ] House Rules → kid view, corrected allowance entry
- [ ] Settings → Notifications, per-category toggles
- [ ] Notification banners — spot-check `N01`, `N03`, `N08`, `N14`, `N21`

---

# §6 — TESTS

```
SLOGANS
[ ] E1.1  Three slides show the exact approved copy
[ ] E1.2  No slide wraps beyond two lines at default size, 390pt
[ ] E1.3  Slogans live in vocabulary.ts, zero hardcoded copies

NOTIFICATIONS
[ ] E2.1  Every notification the app can send maps to an ID in §2.3
[ ] E2.2  Any notification NOT in §2.3 has been deleted (list them)
[ ] E2.3  "Approve when it feels fair" returns ZERO grep results
[ ] E2.4  Interpolated reward name is lower-cased mid-sentence
[ ] E2.5  Five tasks at 19:00 produce exactly ONE notification
[ ] E2.6  Zero exclamation marks in any notification string
[ ] E2.7  Zero emoji in any notification string
[ ] E2.8  Notification at 22:00 is queued to 07:00
[ ] E2.9  Member on Recess receives nothing

HISTORY BUG
[ ] E3.1  Approve a reward → row appears in reward history IMMEDIATELY
[ ] E3.2  Approve a reward → force-quit → relaunch → row still there
[ ] E3.3  Mark allowance paid → appears in allowance history immediately
[ ] E3.4  Stat row counts match the number of rows rendered
[ ] E3.5  Empty state does NOT render when rows exist
[ ] E3.6  Approve at 23:30 Sunday, America/Toronto → lands in THAT week
[ ] E3.7  Rename a reward → history still shows the ORIGINAL name
[ ] E3.8  Delete a reward → its history rows survive intact
[ ] E3.9  No reward or allowance state change is possible without a
          ledger row (verify by direct API call)

VOCABULARY
[ ] E4.1  "Send Allowance" → 0 results
[ ] E4.2  "Manual Send always works" → 0 results
[ ] E4.3  "mint vs special request" → 0 results
[ ] E4.4  Each banned word in §4.4 → 0 results in user-facing strings
[ ] E4.5  Allowance clarifier line renders on the allowance screen
```

---

# §7 — COMPLETION REPORT

**Include this in your final reply, filled in.**

```
CHOREMAXX REVISION E — COMPLETION REPORT

QUESTION 1 (reward requests)
  Answer received from product owner ......... [ A / B / C / NOT ANSWERED ]
  If NOT ANSWERED, §2 must not be marked done.

ITEMS
  §1 Slogans ................................. [ DONE / PARTIAL / NOT STARTED ]
  §2 Notification copy ....................... [ DONE / PARTIAL / NOT STARTED ]
  §3 History bug ............................. [ DONE / PARTIAL / NOT STARTED ]
  §4 Vocabulary audit ........................ [ DONE / PARTIAL / NOT STARTED ]

TESTS
  Slogans (3) ........... __ / 3
  Notifications (9) ..... __ / 9
  History bug (9) ....... __ / 9
  Vocabulary (5) ........ __ / 5

  Failing tests by ID, with reason:
  →

HISTORY BUG — ROOT CAUSE
  Which of the five causes in §3.2 was it? ... #__
  Explain in one paragraph:
  →
  Could the same fault exist elsewhere? ...... [ Y / N ]
  If yes, where:
  →

NOTIFICATIONS DELETED
  Notifications found that were NOT in §2.3, and removed:
  →

GREP RESULTS — all must be 0
  "Send Allowance" ........................ __
  "Approve when it feels fair" ............ __
  "Manual Send always works" .............. __
  "mint vs special request" ............... __
  "ledger" (user-facing) .................. __
  "tally" (user-facing) ................... __
  "origin" (user-facing) .................. __
  "payroll" ............................... __
  "shop" .................................. __
  "Nova" .................................. __
  "roommate" .............................. __
  "Member" (role label) ................... __
  Exclamation marks in notifications ...... __
  Emoji in notifications .................. __

BACKFILL
  Reward history rows recovered ........... __
  Allowance history rows recovered ........ __
  Unrecoverable (left empty, not invented). __

HOUSE RULES ENTRIES REWRITTEN
  Entries that assumed missing context, and what you changed:
  →

SCREENS
  Built and opened ........................ __ / 12
  Not built, and why:
  →

ANYTHING SKIPPED, DEFERRED, OR ASSUMED:
  →

QUESTIONS THAT SHOULD HAVE BEEN ASKED:
  →
```

# ⭐ CHOREMAXX — MASTER BRIEF
## START HERE. READ THIS BEFORE OPENING ANY OTHER DOCUMENT.

---

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   THIS IS THE ENTRY POINT.                                   ║
║                                                              ║
║   There are 5 specification documents for ChoreMaxx.         ║
║   Later ones REVERSE rules in earlier ones.                  ║
║                                                              ║
║   If you read them in the wrong order, or read one           ║
║   without this brief, you WILL implement a rule that         ║
║   was overturned two revisions ago.                          ║
║                                                              ║
║   §3 of this document is the single source of truth for      ║
║   every settled rule. When any other document disagrees      ║
║   with §3, §3 WINS.                                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

# §0 — HOW TO USE THIS

```
STEP 1   Read this entire brief. All of it. Before anything else.

STEP 2   Check §1 for BLOCKING QUESTIONS. If any are unanswered,
         STOP and ask the product owner. Do not guess. Do not
         "pick the sensible one." Ask.

STEP 3   Read §3 — THE RULE SHEET. This is what the app must do.
         Every rule here is settled. Nothing in §3 is negotiable
         or open to interpretation.

STEP 4   Read §4 — THE REVERSAL TABLE. These are rules that were
         changed. If you find the OLD version in the codebase,
         DELETE it. Not comment it out. Not flag it. Delete it.

STEP 5   Work the revision documents in the order given in §5.

STEP 6   Before declaring anything finished, run §6 — THE FINAL
         SWEEP. Paste the results.
```

**Behavioural rules for this whole project:**

1. **Do not invent features.** If a capability is not in one of these documents, it does not exist. Building something unrequested is worse than building nothing — it has to be found and removed later, and it has already happened twice on this project.
2. **Do not leave two code paths.** When a rule changes, the old implementation is deleted. A codebase that contains both the old and new rule will behave as the old one somewhere you didn't check.
3. **Do not paraphrase copy.** Where a document gives exact text in a code block, use it character for character.
4. **Ask rather than assume.** An unanswered question costs a message. A wrong assumption costs a rebuild.
5. **Report what you skipped.** Every revision document ends with a completion report. A summary that isn't in that format is not accepted as finished.

---

# §1 — 🔴 BLOCKING QUESTIONS

## Q1 — Reward requests — ✅ ANSWERED: **B, keep it**

Confirmed wanted. Children can request rewards via **Hold & Request**, gated on completing all of the day's tasks and homework. Revision E notifications `N26` and `N27` are **live** — build them.

Full specification: **Revision F §4.**

## Q2 — Is the free first Streak Rescue confirmed?

**STATUS: AWAITING CONFIRMATION. Does not block — implemented behind a flag.**

A member's first-ever Streak Rescue costs 0 XP. This was recommended, not explicitly requested. It sits behind `FIRST_RESCUE_IS_FREE` in `src/constants/scoring.ts`. Removing it is a one-line change. Confirm before shipping to users.

## Questions already answered — do not ask again

| Question | **Answer** |
|---|---|
| Does ChoreMaxx move real money? | **No. Never.** It records that a parent handed money over. See §3.9. |
| Is "Mint" acceptable? | **Only as a verb on the create action** — `Mint a reward`. Never as a noun, category, or filter. |
| Household-wide or per-child homework proof? | **Per child.** Default ON. |
| Trophy ceiling? | **100,000 XP.** Twelve names unchanged. |
| Late completion XP? | **Reduced, per the Late Credit table.** Full XP is the old, dead rule. |

---

# §2 — DOCUMENT MANIFEST

| # | File | Covers | Status |
|---|---|---|---|
| — | **`choremaxx-MASTER-BRIEF.md`** | ← you are here | **Read first, always** |
| 1 | `choremaxx-v2-cursor-spec.md` | Onboarding, household setup, task picker, recurrence, rewards v1, screen fixes | In force, **heavily superseded** — see §4 |
| 2 | `choremaxx-revision-c-spec.md` | Proof model, reward data-flow bug, role rename, grocery rebuild | In force |
| 3 | `choremaxx-revision-d-spec.md` | Late Credit, Expiry, Streak Rescue, Crowns, Recess, House Rules, notifications, scroll | In force |
| 4 | `choremaxx-revision-e-spec.md` | Intro slogans, notification copy, history bug, vocabulary audit | In force |
| 5 | `choremaxx-revision-f-spec.md` | Per-member invites, Hold & Request, expired tab, task page rebuild, allowance rules, permissions | In force — **newest** |
| 6 | `choremaxx-task-library.json` | 150 tasks · 15 domains · 43 groups | Seed data — **gains `shortName`, Rev F §10.3** |
| 7 | `choremaxx-grocery-categories.json` | 16 aisle categories · 1,120 terms | Seed data — do not edit |

> **Document 1 is the dangerous one.** It is the oldest and the largest, and four of its rules have since been reversed. It contains warning boxes pointing at the newer documents, but **§4 of this brief is the authoritative list.** Check §4 before implementing anything you read in document 1.

---

# §3 — THE RULE SHEET
### Single source of truth. When any document disagrees with this, this wins.

## §3.1 — Identity

| | |
|---|---|
| Product | **ChoreMaxx** — a family household-chore app |
| Audience | Families only. **No roommate mode. No household types.** |
| AI assistant | **Poppins.** Never "Nova" — anywhere, including code, routes, analytics. |
| Roles in code | `admin` \| `member` — never change these values |
| Roles on screen | **Admin** \| **Helper** — never the word "Member" |
| Theme | Dark. All text ≥ **4.5:1** contrast. |

## §3.2 — Reward models

Exactly five. No "No rewards." No "Custom."

```
xp_only        XP on · no rewards · no money
allowance      money on · XP hidden entirely
xp_rewards     XP on · reward catalogue on · no money
xp_allowance   XP on · money on · no reward catalogue
full           everything on          ← recommended default
```

Every screen reads from `CAPABILITIES[household.rewardModel]`. When `xpEnabled` is false, XP is **hidden**, not shown as zero.

## §3.3 — XP

| Rule | Value |
|---|---|
| Valid XP values | **5, 10, 15, 20, 25, 30** — these six only |
| Meritocracy mode | Library values as-is |
| Equity mode | **Flat 10** for every scoring task |
| When awarded | **The instant the child taps Complete.** Never on approval. |
| Stored as | A **snapshot** on the occurrence. Never recomputed. |
| Hygiene tasks (19 of them) | **0 XP.** Streak-tracked instead. |
| Bundle bonus | **+10** full · **+7** if any task in the group was late |

### Late Credit — completed after deadline, before 23:59

| Full | 5 | 10 | 15 | 20 | 25 | 30 |
|---|---|---|---|---|---|---|
| **Late** | **3** | **7** | **12** | **16** | **20** | **25** |

## §3.4 — Deadlines and expiry

| | |
|---|---|
| Default deadline | **19:00** household-local |
| Weekly tasks | **Sunday 19:00** |
| Monthly tasks | **Last Sunday of the month, 19:00** |
| Quarterly | Last Sunday of the quarter's final month, 19:00 |
| **Expiry** | **23:59:59 household-local on the due date** |
| After expiry | Status `expired`. **Cannot be completed by anyone, ever.** |
| `seasonal` / `as_needed` | **Never auto-generate.** Parent triggers them. |

> ⚠️ **`seasonal` must never auto-generate.** Generating "Shovel the snow" every week in July is the kind of defect that gets an app deleted.

## §3.5 — Streaks

> ### ⚠️ ONLY `daily` AND `weekdays` TASKS FEED THE DAILY STREAK
>
> A missed weekly, monthly, or quarterly task costs its XP and shows as *Expired*. It **does not** break a 40-day streak.

**A streak ends at either cliff:**

```
3 consecutive missed days          →  gone, permanently
3 missed days in a rolling 7 days  →  gone, permanently

One line for the kid: "Three misses and the streak is gone —
                      in a row, or in a week."
```

**Day classification:**

| Result | Condition | Effect on the consecutive counter |
|---|---|---|
| `complete` | All qualifying tasks done (on time or late) | **Resets to 0** |
| `missed` | ≥1 qualifying task expired | **Increments** |
| `neutral` | Nothing was due | **Skipped — neither** |
| `recess` | Member on Recess | **Skipped — neither** |

> ⚠️ Neutral and Recess days are **skipped, not counted.** Miss Monday → nothing due Tuesday → miss Wednesday = **2 consecutive**, not 1.

## §3.6 — Streak Rescue

| | |
|---|---|
| Price | **10% of the week's gross XP, PER RESCUED DAY** |
| Maximum | **2 days.** The 3rd consecutive miss is unrescuable. |
| Charged to | The week each rescued day falls in |
| Offered | Immediately at 00:00 rollover |
| Settled | At week close, on the week's **gross** XP |
| No response | **Declines.** Keeps the XP, loses the streak. |
| Effect | **Bridges the gap. Does not credit the day.** Streak 12 → miss → rescue → still 12. |
| Refund at the cliff | **None.** They bought two days and received them. |
| First rescue ever | **Free** — pending confirmation, see Q2 |

> ⚠️ Implement as **10% per day**, not as "10% for one, 20% for two." Identical arithmetic inside a week, and it handles a gap straddling Sunday/Monday with no special case.

## §3.7 — Trophies

Twelve names, unchanged. Ceiling **100,000 XP**.

| 100 | 400 | 1,000 | 2,000 | 4,000 | 10,000 | 18,000 | 28,000 | 40,000 | 55,000 | 75,000 | **100,000** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| First Hundred | Rising Star | Thousand Club | Household Hero | Decorated | Ten Thousand | Immortal Badge | Dynasty Trophy | Ascendant Cup | Sovereign Crown | Eternal Laurel | **Most Glorious** |

`Thousand Club` = exactly 1,000 and `Ten Thousand` = exactly 10,000. The names stay literally true. All thresholds live in one `TROPHY_TIERS` array.

## §3.8 — Crowns

| | |
|---|---|
| **The Week's Crown** | Monday 00:00 → Sunday 23:59:59 |
| **Monthly Sovereign** | 1st → last day of the month |
| Ranked on | **Net XP**, summed from the ledger |
| Ties | **Competition ranking: 1, 1, 3, 4** — never 1, 1, 2, 3 |
| Tie label | `Tied for 1st` on both cards |
| Medals | 1st gold · 2nd silver · 3rd bronze · all ≥4.5:1 contrast |
| Leader at 0 XP | **No crown awarded.** *"No crown this week — let's go again."* |
| Member on Recess | Excluded from ranking, shown greyed as `On recess` |

**Champion's Record visibility — this is a privacy requirement, enforced server-side:**

| Metric | Visible to |
|---|---|
| XP · rank · medal · tasks completed · on-time count · streak · best day | **Everyone in the household** |
| **Late count · Expired count · Rescues used** | **Admins and that person only** |

Restricted fields must be **absent from the API payload** for unauthorised viewers — not present-and-hidden, not zeroed.

## §3.9 — Rewards and allowance

**Nine presets. No XP cost. No emoji. No categories.**

```
Additional screen time   Video game time   Dessert choice
Choose dinner            Choose breakfast  Choose the movie
New video game           Big outing        Room upgrade item
                                           + Mint reward
```

**Mint a reward** has exactly three inputs: name, frequency, approval mode. Nothing else.

> ### ⚠️ CHOREMAXX NEVER MOVES MONEY
>
> It is a **record-keeper**. A parent hands over cash or an e-transfer outside the app, then records it here.
>
> - `Send Allowance` → **`Mark as paid`**
> - `Pay Now` → **`Mark as paid`**
> - Allowance states: **`Owed`** and **`Paid`** — two states, not three
> - Permanent clarifier under the header: *"ChoreMaxx keeps the record. You hand over the money however you normally do."*
>
> Claiming to send money you are not sending is a genuine App Review problem, not just a wording preference.

## §3.10 — Proof

| Type | Rule |
|---|---|
| **Chores** | No upfront requirement. Admins tap **`Request proof`** on a completed task, for 7 days. Admins only. |
| **Homework** | Photo required from the child. **Configured PER CHILD**, default ON. |
| XP | **Never gated by proof.** It lands on tap and stays. |
| `Mark not done` | The only action that reverses XP. Available 7 days. |
| Loop cap | **3 rounds**, then Confirm or Mark not done. |

*"Awaiting confirmation" is a display label, not a hold. The XP is already in the balance and already counts toward trophies.*

## §3.11 — Recess

| | |
|---|---|
| Scope | **Per member**, with an "Everyone" shortcut |
| Who | **Admins only**, enforced server-side |
| Occurrences generated | **None.** Not deferred. Not queued. Not stacked. |
| Streak | **Frozen at value.** Leave at 12, return at 12. |
| Allowance | No auto-payment. Manual `Mark as paid` still available. |
| Crowns | Excluded for any period they were on Recess |
| Backdating | Up to **3 days**. Restores broken streaks, refunds rescues paid in the window. |

## §3.12 — Task library

| | |
|---|---|
| Tasks | **150** |
| Domains | **15** — 14 on the Chores tab, 1 on the Homework tab |
| Groups | **43** |
| XP-scoring | 131 |
| Streak-tracked | 19 (Personal Hygiene, 0 XP by design) |

**Homework is its own tab next to Tasks.** The `homework_education` domain must **not** appear in the chores domain grid. One view, one data model — do not fork it.

## §3.13 — Grocery

16 aisle categories, classified locally from `choremaxx-grocery-categories.json`.

> ⚠️ **Never route classification through Poppins or any model call.** It is a dictionary lookup — under a frame, offline, deterministic. Longest phrase wins: `frozen peas` beats `peas`, `almond milk` beats `milk`.

Reference cases that must pass: `Milk` → Dairy & Eggs · `Cake` → Bakery · `Steak` → Meat & Seafood.

Entry point is a **large square card with a cart icon on Home**, not a text row.

## §3.14 — Intro slogans

Exact copy, in this order, sentence case with full stops:

```
Built for real families with high standards.
Everyone knows what's theirs to do.
Poppins keeps the whole house in step.
```

---

# §4 — 🔴 THE REVERSAL TABLE
### Every rule that changed. If you find the OLD version in the code, DELETE it.

| # | Rule | ❌ OLD — delete on sight | ✅ CURRENT | Where it changed |
|---|---|---|---|---|
| R1 | Late completion XP | Full XP | **Late Credit table** | Rev D §1.2 |
| R2 | Task after 23:59 | Still completable | **Expired. Uncompletable.** | Rev D §1.3 |
| R3 | Streak rescue price | −15% / −30% / −50% | **−10% per day, max 2** | Rev D §1.5 |
| R4 | Streak break | One missed day | **3 consecutive, or 3 in a rolling 7** | Rev D §1.4 |
| R5 | Occurrence status | `missed` | **`expired`** | Rev D §1.3 |
| R6 | Photo proof on chores | Pre-set `requiresPhoto` checkbox | **On-demand admin request** | Rev C §1.1 |
| R7 | Homework proof scope | Household-wide | **Per child** | Rev E / Rev C §1.2 |
| R8 | XP timing | On parent approval | **On the child's tap** | Rev B §1.7 |
| R9 | Role label | `Member` | **`Helper`** | Rev C §3 |
| R10 | Allowance action | `Send Allowance` / `Pay Now` | **`Mark as paid`** | Rev E §4.1 |
| R11 | Allowance states | Unpaid / Approved / Pending | **Owed / Paid** | Rev E §3.5 |
| R12 | Trophy ceiling | 1,000,000 XP | **100,000 XP** | Rev B §9 |
| R13 | Task category | Rooms | **15 domains** | Rev B §1.3 |
| R14 | Task priority | Low / Medium / High | **Removed entirely** | Rev C |
| R15 | Reward XP cost | Rewards bought with XP | **Removed. Rewards are earned.** | Rev B §6.1 |
| R16 | Household type | Family / Roommates / Multi-gen | **Removed. Family only.** | Rev B §1.2 |
| R17 | Home metrics | Completion / Fairness / Streak | **Completion / Streak** | Rev B §7.1 |
| R18 | AI assistant | Nova | **Poppins** | Rev B §1.1 |
| R19 | Grocery feature | "Grocery Intelligence" + budget + store + storage | **Simple auto-categorised list** | Rev C §4 |
| R20 | Vacation mode | — | **Recess** | Rev D §3 |
| R21 | Invite scope | Household-level QR + link | **Per member**, 7-day, single-use | Rev F §3 |
| R22 | Completing a task | Admin could complete for others | **Assignee only** | Rev F §12 |
| R23 | Task page controls | Custom task / Create a task / Quick presets buttons | **All three removed**, Assign is sticky | Rev F §9 |
| R24 | Expired tasks | Mixed into the active list | **Own tab, 7-day view window** | Rev F §5 |
| R25 | "No XP cost" copy | Present on Mint a reward | **Deleted** | Rev F §11.1 |

**Task R.a** — [ ] For every row above, grep the codebase for the OLD behaviour and confirm zero occurrences. Report the count for each.

---

# §5 — EXECUTION ORDER

Some of this may already be built. **Verify before assuming.** Where something exists, check it against §3 rather than trusting it.

```
PHASE A — DATA INTEGRITY (do first, these are live bugs)
  A1  Rev C §2.1   Onboarding rewards never reach the Rewards Center
  A2  Rev E §3     Reward and allowance history showing zero
      → Both are the same defect: write path and read path disagree.
        Fix the PATTERN. One write function, one table, one read path.

PHASE B — SCORING ENGINE (no UI until tests pass)
  B1  Rev D §1.1   Constants file
  B2  Rev D §1.2   Late Credit
  B3  Rev D §1.3   Expiry
  B4  Rev D §1.4   Streak cliffs
  B5  Rev D §1.5   Streak Rescue
  B6  Rev D §1.6   XP Ledger
      → STOP GATE 1: 28 tests must pass. Paste output.

PHASE C — SURFACES
  C1  Rev D §2     Crowns and Champion's Record      (10 tests)
  C2  Rev D §3     Recess                            (11 tests)
  C3  Rev C §1     Proof model
  C4  Rev C §2     Rewards rebuild
  C5  Rev C §4     Grocery rebuild

PHASE D — COPY AND POLISH
  D1  Rev E §1     Intro slogans
  D2  Rev E §2     Notification registry     ← BLOCKED ON Q1
  D3  Rev E §4     Vocabulary audit
  D4  Rev C §3     Role rename to Helper
  D5  Rev D §5.2   Scroll indicators

PHASE E — LAST
  E1  Rev D §4     House Rules
      → Must be last. The manual is GENERATED from settled
        settings. Build it before the rules settle and it
        will describe an app that no longer exists.
```

---

# §6 — THE FINAL SWEEP
### Run before declaring anything finished. Paste every result.

## §6.1 — Banned strings. All must return **0**.

```
CODE + UI
[ ] Nova              [ ] roommate          [ ] householdType
[ ] Household Games   [ ] Fairness          [ ] payroll
[ ] missed (status)   [ ] vacation mode     [ ] redemption
[ ] late penalty      [ ] requiresPhoto     [ ] Room (task field)
[ ] priority (task)   [ ] xpCost            [ ] Grocery Intelligence

USER-FACING COPY ONLY
[ ] ledger    [ ] tally     [ ] origin    [ ] asks (noun)
[ ] occurrence [ ] shop     [ ] user      [ ] Member (role label)
[ ] Send Allowance          [ ] Pay Now
[ ] "Approve when it feels fair"
[ ] "Manual Send always works"
[ ] "mint vs special request"

NOTIFICATIONS
[ ] Exclamation marks     → 0
[ ] Emoji                 → 0
[ ] Notifications not in Rev E §2.3 → 0 (list any you deleted)

STREAK MATH
[ ] 0.15 / 0.30 / 0.50 in any streak context → 0
```

## §6.2 — Behavioural spot-checks

```
[ ] Complete a daily task 4× in one session → ONE row, no duplicates
[ ] 10 XP task at 19:30 → awards 7, not 10
[ ] Task at 00:01 next day → expired, no Complete button rendered
[ ] Miss Mon, nothing due Tue, miss Wed → consecutive count = 2
[ ] Expired WEEKLY task → daily streak unchanged
[ ] Streak 12 → 20 days Recess → returns 12
[ ] Zero occurrences generated during Recess
[ ] Two tied at top → both gold, next is bronze, no silver
[ ] Leader at 0 XP → no crown
[ ] Helper requests sibling's record → late/expired/rescue fields ABSENT
[ ] Helper attempts assign / approve / mark paid via API → rejected
[ ] Approve a reward → appears in history immediately, survives relaunch
[ ] Approve at 23:30 Sunday, America/Toronto → lands in THAT week
[ ] Five tasks at 19:00 → exactly ONE notification
[ ] "Shovel the snow" in July → zero occurrences generated
[ ] Milk → Dairy & Eggs, offline, no network call
[ ] Kid House Rules view fits ONE screen, no scroll
```

## §6.3 — Structural

```
[ ] Every number from §3 lives in a constants file, used once
[ ] Every new field has a migration with a backfill
[ ] All day-boundary math uses household.timezone — never device, never UTC
[ ] No XP mutation exists outside applyXpChange()
[ ] No reward mutation exists outside applyRewardChange()
[ ] No allowance mutation exists outside applyAllowanceChange()
[ ] Task picker is ONE shared component, not three copies
[ ] Reward picker is ONE shared component, not three copies
[ ] Gold / silver / bronze each ≥ 4.5:1 contrast (report hex + ratio)
```

---

# §7 — MASTER COMPLETION REPORT

```
CHOREMAXX — MASTER COMPLETION REPORT

BLOCKING QUESTIONS
  Q1 reward requests ....... ANSWERED: B (see Rev F §4)
  Q2 free first rescue ..... [ CONFIRMED / REMOVED / UNANSWERED ]

PHASES
  A  Data integrity ........ [ DONE / PARTIAL / NOT STARTED ]
  B  Scoring engine ........ [ DONE / PARTIAL / NOT STARTED ]
  C  Surfaces .............. [ DONE / PARTIAL / NOT STARTED ]
  D  Copy and polish ....... [ DONE / PARTIAL / NOT STARTED ]
  E  House Rules ........... [ DONE / PARTIAL / NOT STARTED ]

REVERSAL TABLE (§4)
  Old behaviour found and deleted, by row:
  R1 __  R2 __  R3 __  R4 __  R5 __  R6 __  R7 __
  R8 __  R9 __  R10 __ R11 __ R12 __ R13 __ R14 __
  R15 __ R16 __ R17 __ R18 __ R19 __ R20 __ R21 __
  R22 __ R23 __ R24 __ R25 __
  (report the count found; all should now be 0)

FINAL SWEEP
  Banned strings ........... __ / 30 returned 0
  Spot-checks .............. __ / 17 passed
  Structural ............... __ / 9 passed

  Every failure, by name, with reason:
  →

TESTS ACROSS ALL DOCUMENTS
  Rev D Gate 1 ..... __ / 28      Rev D Gate 4 ..... __ / 8
  Rev D Gate 2 ..... __ / 10      Rev D Gate 5 ..... __ / 6
  Rev D Gate 3 ..... __ / 11      Rev E ............ __ / 26

CONTRAST
  Gold ____ (__:1)   Silver ____ (__:1)   Bronze ____ (__:1)

ANYTHING SKIPPED, DEFERRED, OR ASSUMED — be specific:
  →

FEATURES I BUILT THAT WERE NOT IN A DOCUMENT:
  → (should be "none")

QUESTIONS I SHOULD HAVE ASKED:
  →
```

---

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   IF YOU ARE UNSURE, ASK.                                    ║
║                                                              ║
║   A question costs one message.                              ║
║   A wrong assumption costs a rebuild.                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

# ChoreMaxx — Revision C: App Logic Changes

**Companion to `choremaxx-v2-cursor-spec.md` (Revision B).** Read that first. This document changes four areas of logic and **supersedes** the sections listed below.

| This document | Supersedes in Revision B |
|---|---|
| §1 Proof requests | §1.7 (completion & proof loop), §4.5 (`requiresPhoto` checkbox) |
| §2 Rewards | §6.2–6.4 (reward catalogue, assignment flow, custom rewards) |
| §3 Role naming | §1.6 (permission matrix — labels only, permissions unchanged) |
| §4 Grocery list | New — no prior section |

**Unchanged and still authoritative:** XP is awarded the moment the child taps Complete. Nothing in this document gates a reward behind a parent action. Verification remains a layer that runs *after* the reward has landed.

New data file: **`choremaxx-grocery-categories.json`** — 16 aisle categories, 1,120 classification terms.

---

## 1. Proof requests — optional for chores, per-child for homework

The problem with Revision B: `requiresPhoto` was a flag set at assignment time, which forced a parent to predict which tasks they'd want to check. That's a decision made at the wrong moment, and it makes proof feel like surveillance rather than a spot-check.

**The corrected model: proof is requested after the fact on chores, and required up front on homework — configured per child.**

### 1.1 Chores — proof is an on-demand admin action

**Remove** the `Require photo proof after complete` checkbox from the custom-task sheet entirely. No chore carries a proof requirement upfront.

**Completed chore card, as seen by an admin:**

```
┌──────────────────────────────────────────────┐
│ ✅  Wipe down kitchen counters      +10 XP   │
│     Completed today · 6:42 PM                │
│                                              │
│     [ 📷 Request proof ]                     │
└──────────────────────────────────────────────┘
```

- The ✅ and the XP award are already final. The button does not undo or hold them.
- **The `Request proof` button renders only for admins.** A child viewing their own completed task sees the ✅ and the XP and nothing else. Do not render it disabled for Helpers — a hidden door is better than a locked one.
- Available on any completed occurrence for **7 days**, matching the `Mark not done` reversal window from Revision B §1.7. After that the ledger is settled and the button disappears.
- One tap opens a small sheet with an optional note (*"Send me a photo of the counters"*), then Send.

**What happens on request:**

| | |
|---|---|
| Occurrence `status` | **unchanged** — stays `completed` |
| `awardedXp` | **unchanged** — the child keeps it |
| Streak | **unchanged** |
| `verification` | `not_required` → `proof_requested` |
| Child sees | Task resurfaces at the top of their list with the note and an `Add photo` action |
| Notification | Child notified immediately |

**On submission:** `verification` → `unreviewed`. The admin gets the photo with inline `Confirm` / `Ask again` / `Mark not done` actions. Auto-confirms at 72h if the admin does nothing.

**Cap at 3 rounds**, then the admin must Confirm or Mark not done.

`Mark not done` is the only path that touches XP — behaviour unchanged from Revision B §1.7 (reverse `awardedXp`, return status to `pending`/`late`/`missed`, recalculate the streak).

### 1.2 Homework — photo proof required, configured PER CHILD

Homework works differently because "I did my homework" is unverifiable in a way that "I took the bins out" is not.

**The setting lives on the member, not the household.** A 15-year-old and a 7-year-old warrant different answers, and a household-wide switch forces the parent to pick the stricter one for everybody. Per-child costs nothing now and is an awkward migration later.

```ts
interface Member {
  // ...
  homeworkProofRequired: boolean;   // default TRUE on creation
}
```

- **Default `true`** for every newly created member.
- There is **no household-level setting** and no inherited default. One concept, one place. A parent adding a fourth child gets the default and can change it in ten seconds.
- **Do not ask during the Add-member wizard.** The whole thrust of this build is fewer setup decisions. It defaults ON and is editable later.

**Where it's configured — Settings → Household → Homework proof:**

```
┌────────────────────────────────────────┐
│  ‹ Back      Homework proof            │
│                                        │
│  Kids attach a photo when they mark    │
│  homework done. You'll get it to       │
│  review — their points land either way.│
│                                        │
│   (M)  Maya                     [ ON ] │
│   (L)  Liam                     [ ON ] │
│   (S)  Sofia                    [OFF ] │
│                                        │
└────────────────────────────────────────┘
```

One screen, every child, one toggle each. Also expose the same toggle inside each member's own profile page so a parent who is already looking at Maya doesn't have to navigate elsewhere — both surfaces write the same field.

**Completion flow when the child's `homeworkProofRequired` is ON:**

```
Child taps Complete
        ↓
Photo capture opens IMMEDIATELY — cannot be skipped
        ↓
Photo attached → status: completed
                 XP awarded IMMEDIATELY
                 verification: 'unreviewed'
        ↓
Child's card shows: ✅ +20 XP · Awaiting confirmation
Admin notified with the photo
        ↓
   ┌────────────┬──────────────┬───────────────┐
   ↓            ↓              ↓               ↓
Confirm     Ask again    Mark not done   (no action)
   ↓            ↓              ↓               ↓
'confirmed'  another      XP reversed    auto-confirms
XP unchanged  photo       status→pending   at 72h
```

**When the child's toggle is OFF:** homework behaves exactly like a chore. No forced capture, `verification` starts at `not_required`, and the admin can still request proof after the fact per §1.1. **Nothing is lost by turning it off** — the ad-hoc path always remains. Say this in the helper text so a parent isn't afraid to use the toggle.

**Critical: "awaiting confirmation" is a display state, not a hold on the reward.** The XP is in the child's balance, counted toward trophies, and counted toward the streak from the moment they submit. The label communicates that a parent will look, not that the reward is pending. Do not build a pending-XP pool — it would break the trophy ladder arithmetic and reintroduce exactly the approval-gate problem Revision B removed.

**Camera behaviour:** offer both camera and photo library — a scan of a worksheet from the library is as valid as a live photo, and a child on a laptop-based assignment needs the library path. Compress client-side to ≤1600px on the long edge before upload; homework photos are the highest-volume image in this app and full-resolution uploads will hurt.

**Mixed households are the normal case.** Build every homework query, notification, and list view to read the flag per occupant rather than branching once at the household level. A sibling list showing Maya's "Awaiting confirmation" next to Liam's plain ✅ is correct and expected.

### 1.3 Model changes

```ts
interface TaskOccurrence {
  // ...from Revision B §1.7
  verification: 'not_required' | 'unreviewed' | 'confirmed'
              | 'proof_requested' | 'rejected';
  proofRounds: ProofRound[];        // { requestedAt, note?, photoUrl?, submittedAt? }
  proofRequestedBy?: string;        // admin id — chores only
}

interface Member {
  homeworkProofRequired: boolean;   // default true
}
```

**Initial `verification` value at completion:**

| Task type | Child's setting | Starting `verification` |
|---|---|---|
| Chore | — | `not_required` |
| Homework | `homeworkProofRequired: true` | `unreviewed` (photo attached) |
| Homework | `homeworkProofRequired: false` | `not_required` |

**Migration:** add the column with default `true` for all existing members. No household-level field is created; if a `household.homeworkProofRequired` was already shipped, migrate its value down to every member and drop the column.

**Acceptance criteria — §1**
- [ ] No `Require photo proof` checkbox exists in the custom-task sheet.
- [ ] `Request proof` appears on completed chores for admins only — verified by logging in as a Helper.
- [ ] Requesting proof leaves XP, streak, and `status` untouched.
- [ ] `Request proof` disappears 8 days after completion.
- [ ] The homework toggle is **per child** and reachable from both Settings → Household → Homework proof and the member's own profile; both write the same field.
- [ ] A newly created member defaults to ON without being asked during setup.
- [ ] In one household: child A (ON) cannot complete homework without a photo; child B (OFF) can, in the same session.
- [ ] Homework XP lands in the child's balance immediately and counts toward trophies before any admin action.
- [ ] With the toggle OFF, an admin can still request proof after the fact.
- [ ] Proof loop caps at 3 rounds for both chores and homework.

---

## 2. Rewards — fix the data flow, then rebuild the surface

### 2.1 The bug: onboarding rewards never reach the Rewards Center

Rewards configured during first-run setup do not appear in the Rewards section. This is a **persistence and read-path defect**, not a UI defect — fix it first, before touching any screen.

**Diagnose in this order:**
1. Does onboarding write reward selections to the backend at all, or hold them in local wizard state that's discarded on completion?
2. Does it write to the same collection the Rewards Center reads from, or to a separate onboarding-scoped store?
3. Is the write scoped to the right `householdId` and `memberId`?

**The required end state — one canonical store, written by onboarding, read by everything:**

```ts
// The household's catalogue of available rewards (presets + minted)
interface HouseholdReward {
  id: string;
  householdId: string;
  name: string;
  isCustom: boolean;                              // true = minted by this household
  approvalMode: 'instant' | 'requires_approval';
  active: boolean;
}

// A reward actually assigned to a person, with its cadence
interface MemberRewardAssignment {
  id: string;
  memberId: string;
  rewardId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  quantity?: string;                              // '30 min' | '1 hr' | '2 hrs'
  createdAt: string;
}

// A person's allowance, if any
interface MemberAllowance {
  id: string;
  memberId: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
}
```

**Non-negotiable:** the onboarding wizard's Step C writes to exactly these three tables. The Rewards Center reads from exactly these three tables. There is no second path. If you find a parallel onboarding-only store, delete it and migrate its contents.

**Write a regression test that does the whole loop:** complete onboarding with two rewards and an allowance for one child → assert they render in the Rewards Center without an app restart. This bug will come back otherwise.

**Migration:** existing households whose onboarding selections were lost cannot be recovered — the data was never written. On first launch after the fix, if a household has `setupComplete: true` but zero `MemberRewardAssignment` rows and a reward-enabled model, show a one-time prompt: *"Set up rewards for your family"* linking to the Rewards Center. Do not silently leave them with an empty screen.

### 2.2 The Rewards Center entry point — two buttons, then combine

Replace whatever currently sits at the top of the Rewards section with two clear choices:

```
┌─────────────────────┐  ┌─────────────────────┐
│                     │  │                     │
│      REWARD         │  │     ALLOWANCE       │
│  Privileges & treats│  │    Real money       │
│                     │  │                     │
└─────────────────────┘  └─────────────────────┘
```

- Both render as equal-weight square cards. Neither is pre-selected.
- Visibility follows `CAPABILITIES[household.rewardModel]` (Revision B §2.2): a household on `allowance` sees only the Allowance card, one on `xp_rewards` sees only Reward, one on `full` sees both.

**After choosing one, offer the other.** Once the first is configured, show a single inline prompt at the bottom of the sheet:

> `+ Add an allowance too` (or `+ Add a reward too`)

- Not a modal, not a new screen — one tappable row that expands the second section in place.
- Only shown when the household's reward model permits both. Never nag: if dismissed, don't re-show it in that session.

**Frequency is set per item, on completion of that day's assigned work.** Both rewards and allowance carry their own `Daily / Weekly / Monthly` picker. State the trigger plainly in helper text under the picker: *"Earned when {Name} finishes their tasks and homework for the day."* — the child and parent should never have to guess what unlocks it.

### 2.3 Every reward surface: presets first, Mint last

Anywhere a reward can be chosen — onboarding Step C, the Rewards Center, editing a child — the layout is identical:

```
   [ Additional screen time ]  [ Video game time ]
   [ Dessert choice ]          [ Choose dinner ]
   [ Choose breakfast ]        [ Choose the movie ]
   [ New video game ]          [ Big outing ]
   [ Room upgrade item ]       [ + Mint reward ]
```

- The nine presets from Revision B §6.2, in that order, then **`+ Mint reward`** as the final tile.
- `Mint reward` is visually distinguished (dashed border, muted) so it reads as "make your own" rather than as a tenth preset.
- Minted rewards join the household catalogue and appear inline with the presets on every subsequent visit, marked so they can be edited or removed.
- Build this once as a shared `RewardPicker` component. Three near-identical implementations is how the onboarding/Rewards-Center mismatch in §2.1 happened in the first place.

### 2.4 Mint Reward sheet — strip it down

**Remove entirely:**
- ❌ All category selection / category chips
- ❌ The emoji picker section
- ❌ XP cost (rewards are not purchased — Revision B §6.1)

**What remains — three fields:**

```
┌────────────────────────────────────┐
│  Mint a reward                     │
│                                    │
│  Name                              │
│  [ Sleepover with a friend      ]  │
│                                    │
│  How often                         │
│  [ Daily ] [ Weekly ] [ Monthly ]  │
│                                    │
│  ○ Reward instantly                │
│  ● Ask me to approve first         │
│                                    │
│           [ Mint reward ]          │
└────────────────────────────────────┘
```

**The approval option** is the only setting that survives, and it maps to `HouseholdReward.approvalMode`:

| Mode | Behaviour when the child earns it |
|---|---|
| `instant` | Granted automatically. Child notified: *"You earned: Dessert choice."* Parent notified for awareness only. |
| `requires_approval` | Child sees *"Ready to claim — waiting on a grown-up."* Admin gets a notification with `Grant` / `Not this time`. |

- Default for **minted** rewards: `requires_approval`. A parent inventing a bespoke reward is more likely to want a say in it.
- Default for **presets**: `instant` for the daily-tier three (screen time, game time, dessert), `requires_approval` for everything weekly and monthly. Higher-value rewards warrant a check; a dessert choice does not.
- `approvalMode` is editable per reward from the Rewards Center at any time.
- **This approval is about granting a privilege, not about XP.** It never touches XP, streaks, or allowance. Do not reuse the task-verification code path.

**Acceptance criteria — §2**
- [ ] Rewards and allowance configured in onboarding appear in the Rewards Center immediately, no restart. Covered by an automated end-to-end test.
- [ ] Onboarding and the Rewards Center demonstrably read and write the same three tables.
- [ ] The Rewards section opens with two equal cards; the combine prompt appears only after the first is configured.
- [ ] The Mint sheet has exactly three inputs — no categories, no emoji, no XP cost.
- [ ] All nine presets plus `+ Mint reward` render on every reward surface via one shared component.
- [ ] A minted reward is assignable to a second child without re-creating it.

---

## 3. Rename the "Member" role

Permissions do not change. **Only the display label changes.** The code identifiers stay `admin` and `member` throughout — routes, enums, database values, API payloads. Changing stored values to match a display string is how you get a migration you didn't need.

**Implementation:** put both labels in one constants file. A future change should be a one-line edit, not a repo-wide search.

```ts
export const ROLE_LABELS = {
  admin:  'Admin',
  member: 'Helper',      // ← the change
} as const;
```

Every user-facing string reads from this map. No hardcoded "Member" anywhere.

### 3.1 Recommended: **Helper**

| Option | Pairs with | Read |
|---|---|---|
| **Helper** ← recommended | Admin | Warm, describes the contribution, works for a 6-year-old and a 16-year-old alike. Doesn't presume family structure. |
| Crew | Captain | Playful and it suits the XP/trophy/ranks system well. Requires renaming Admin too. |
| Kid | Parent | Warmest of all, but wrong the moment a grandparent, an older sibling, or an au pair is the admin — and wrong for an adult who isn't running the household. |
| Teammate | Captain | Fine, but slightly corporate-offsite. |
| Family member | Admin | Accurate, forgettable, and long enough to wrap on narrow screens. |

**Helper** is the recommendation because it's the only option that's warm *and* stays true regardless of who's in the household. "Kid" is more charming but it breaks for the exact households that need a chore app most — blended families, multigenerational homes, single parents with a teenager who co-administers.

**If you want to rename Admin as well,** `Captain / Crew` is the strongest pair and would suit the game-adjacent tone of the trophies. That's a bigger copy change — flag it and it can be spec'd.

**Where the label appears** — audit all of these: the role toggle in the Add-member wizard (Revision B §3.5 Step A), the roster cards, Settings → Household, the permission-denied empty states, and any onboarding copy describing who can do what.

**Acceptance criteria — §3**
- [ ] The word "Member" appears in no user-facing string.
- [ ] `ROLE_LABELS` is the single source; grep confirms no hardcoded role labels.
- [ ] Database values, enums, and API contracts still use `admin` / `member`.

---

## 4. Grocery list — rebuild

### 4.1 Remove

- ❌ The words **"Grocery Intelligence"** everywhere. The feature is a shopping list; calling it intelligence promises something it isn't and makes it sound like work.
- ❌ **Budget** — field, tracking, warnings, and any spend calculation.
- ❌ **Preferred store** — selector, per-store logic, store-specific aisle ordering.
- ❌ **Storage options** — pantry/fridge/freezer assignment and any expiry tracking built on it.

Delete the underlying models too, not just the UI. Anything reading `budget`, `preferredStore`, or `storageLocation` comes out.

### 4.2 The new model: type it, it files itself

One list. Every item lands in its aisle category the instant it's added — no category picker, no second step.

```
┌────────────────────────────────────────┐
│  🛒  Groceries                    ⋯    │
├────────────────────────────────────────┤
│  [ Add an item…                     ]  │
├────────────────────────────────────────┤
│  ○ Milk                    Dairy & Eggs│
│  ○ Cake                         Bakery │
│  ○ Steak                Meat & Seafood │
│  ○ Bananas                     Produce │
│  ✓ Paper towels           Household    │
├────────────────────────────────────────┤
│         [  View list by aisle  ]       │
└────────────────────────────────────────┘
```

- Type, hit return, item appears with its category tag already applied. Focus stays in the field so a whole list can be typed in one go.
- The category tag is a small muted label on the right of each row — tappable to reassign if the guess was wrong.
- Checking an item strikes it through and sinks it to the bottom. It is not deleted; a `Clear checked` action in the ⋯ menu removes them.

### 4.3 Classification — local lexicon, not an AI call

Seed from **`choremaxx-grocery-categories.json`**: 16 categories, 1,120 terms, English plus common Québec French.

**Do not route this through Poppins or any model call.** It's a dictionary lookup — it must resolve in under a frame, work offline, and return the same answer every time. A network round-trip to categorise "milk" is the wrong engineering and users will feel the lag on every keystroke.

**Matching cascade — first hit wins:**

1. **Exact match** on the normalised string (lowercase, accents stripped, punctuation removed).
2. **Longest phrase match** — scan right-to-left for the longest known multi-word term. `frozen peas` must beat `peas`; `almond milk` must beat `milk`. This ordering matters more than any other rule here.
3. **Head-noun match** — take the last token and look it up. `organic whole milk` → `milk` → Dairy & Eggs. Handles the quantity/brand/adjective prefixes people actually type.
4. **Singularise and retry** — strip trailing `s`/`es` and repeat steps 1–3.
5. **Fuzzy** — Levenshtein ≤1 on tokens of 5+ characters, so `bananna` still lands in Produce.
6. **Fall back to `other`** and surface the row with a subtle `Tap to categorise` hint. Never guess wildly; an unhelpful "Other" is better than confidently filing milk under Pet.

**Household learning:** when a user corrects a category, store the override in a household-scoped map and check it *before* step 1. If a family calls something by a name the lexicon doesn't know, they should have to teach it exactly once.

**Quantities:** strip a leading quantity before classifying and keep it as display text. `2 lbs chicken` → quantity `2 lbs`, item `chicken` → Meat & Seafood. Match `\d+\s*(lb|lbs|kg|g|oz|x|pack|dozen|L|ml)?` at the start of the string.

**Category order is aisle order.** The JSON's `order` field walks the store: Produce → Bakery → Deli → Meat & Seafood → Dairy & Eggs → Breakfast → Pantry → Canned → Snacks → Frozen → Beverages → Baby & Kids → Household → Personal Care → Pet → Other. Frozen sits late deliberately — nobody wants ice cream melting through the rest of the trip.

### 4.4 "View list by aisle"

The button opens the shopping view. This is the screen someone is actually holding in a store, so it is optimised for a phone in one hand.

```
┌────────────────────────────────────────┐
│  ‹ Back        Shopping        6 left  │
├────────────────────────────────────────┤
│  PRODUCE                          2    │
│    ○ Bananas                           │
│    ○ Spinach                           │
│                                        │
│  BAKERY                           1    │
│    ○ Cake                              │
│                                        │
│  MEAT & SEAFOOD                   1    │
│    ○ Steak            2 lbs            │
│                                        │
│  DAIRY & EGGS                     2    │
│    ○ Milk                              │
│    ○ Greek yogurt                      │
└────────────────────────────────────────┘
```

- Grouped by category, in aisle order. **Empty categories are not rendered.**
- Larger tap targets than the edit view — checking items should work with a thumb while pushing a cart.
- A completed category collapses automatically with a checkmark, so the list shortens visibly as the trip progresses. This is the small detail that makes the screen feel good to use.
- **Keep the screen awake** while this view is open.
- Header shows remaining count, not total. `6 left` is more useful in an aisle than `4 of 10`.

### 4.5 Home screen — a real grocery button

The current entry point is a small `Groceries stocked` text row that reads as a status label, not a button. Replace it.

- A **large square card on the Home screen** with a **shopping cart icon**, labelled `Groceries`, with a live subtitle: `12 items · 5 categories`, or `List is empty` when there's nothing on it.
- Size it to match the other primary Home cards — this is a top-level destination, not a footnote.
- Place it in a **two-up row** alongside the next most-used card so the grid stays balanced. Do not let it float full-width and unbalanced.
- Tapping it opens the list directly. No intermediate menu.
- **Admins build the list.** Helpers can add items; only admins can clear the list. "We're out of milk" is exactly the kind of thing a kid notices first, and the cost of a wrong entry is one tap to delete.
- The card shows a small badge when items have been added since the admin last opened it.

**Acceptance criteria — §4**
- [ ] `Grocery Intelligence`, budget, preferred store, and storage options are gone from UI and data model.
- [ ] `Milk` → Dairy & Eggs, `Cake` → Bakery, `Steak` → Meat & Seafood, typed with no second step. (These three are the reference cases — assert them in a test.)
- [ ] `frozen peas` → Frozen, not Produce. `almond milk` → Dairy & Eggs. Longest-phrase-wins is verified.
- [ ] `2 lbs chicken` files under Meat & Seafood with `2 lbs` preserved as display text.
- [ ] Classification runs offline with no network call.
- [ ] A corrected category persists for that household and applies to future entries.
- [ ] The aisle view groups correctly, hides empty categories, and keeps the screen awake.
- [ ] The Home grocery card is a large square with a cart icon and a live item count.

---

## 5. Decisions — resolved

| # | Question | Decision |
|---|---|---|
| 5.1 | Homework proof scope | **Per child**, not household-wide. Default ON for every new member. Managed from Settings → Household → Homework proof and from each member's profile. |
| 5.2 | Can Helpers add grocery items? | **Yes.** Helpers add, only admins clear the list. |
| 5.3 | Preset reward approval defaults | Daily-tier presets `instant`; weekly and monthly `requires_approval`. Editable per reward. |
| 5.4 | Rename Admin too? | **Not for now.** Only `member → Helper`. `Captain / Crew` remains available if you want both renamed later. |

---

## 6. Build order

1. **§2.1 first** — the reward persistence bug. It's a live defect losing real user data, and everything else in §2 sits on top of it.
2. **§1** — proof model. Touches the completion path, which §2's reward triggers depend on. Note the per-child flag lands on `Member`, so do the migration before the UI.
3. **§4** — grocery. Self-contained; can run in parallel with §1 if you have the hands.
4. **§3** — role label. Fifteen minutes, do it last so it doesn't collide with the copy changes above.

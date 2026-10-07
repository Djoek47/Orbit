# House Rules — implementation spec (v4)

**Read this document in full before writing a line of code. Do not begin with the interface.**

The layout is settled: **At a glance**. The three alternatives that were under consideration have been removed from the content file and from this document, so that nothing here is optional or open to interpretation.

You have been given three files. They are not three drafts of the same thing:

| File | What it is | Ships? |
|---|---|---|
| `house-rules.json` | The content, and the single source of truth. | **Yes — into the app bundle** |
| `house-rules.html` | A working reference renderer. Open it in a browser. | No — reference only |
| `CURSOR-SPEC-house-rules.md` | This document. | No |

The reference renderer already implements everything described here: filtering, token substitution, chapter grouping and all fifteen visuals, in both modes. **Where this document and the renderer disagree, the renderer is correct.** Read its `isVisible`, `visibleRules`, `groupByChapter` and `tok` functions before writing your own. They come to roughly forty lines, and they are the entire logic layer.

---

## 0. Defects in the current build — fix these first

Screenshots of the build in progress show three faults. Each one indicates the same underlying problem: **the screen is not reading `house-rules.json`.** Fix that cause, not the three symptoms.

**1. The copy does not match the content file.** The build shows *"A parent sets your list"*, *"Admins and Helpers"*, and *"The kid version rewrites itself to match"*. None of those strings exists in `house-rules.json` — it says *"An admin sets your list"*, *"Admins and Sidekicks"*, and *"The Sidekick version"*. Copy is being typed into views, or read from a stale copy of the file. Neither is acceptable; see §1.1.

**2. Token substitution is slicing the string.** The build renders *"Finish your tasks by 7:00 PM"* with only the `7` swapped in and boxed. The placeholder is `{dailyDeadline}` and it resolves to the entire time — *"7:00 PM"* — not to the hour. Replace the whole placeholder, braces included.

**3. Resolved tokens are being styled as chips.** The `7` and the `30` render as highlighted badges inside running sentences. **A resolved token is a word in a sentence.** It takes the styling of the text around it: no badge, no box, no accent colour, no background. This applies everywhere, in both modes.

Also visible: the Sidekick bell tile prints the time twice — once large and once again beside it — and rules appear under the wrong chapter (*"Only the assignee completes"* shown under Household; it belongs to Earning, as `EARN-04`). Both resolve themselves once the screen renders from the file.

---

## 1. Terminology

The two modes are **Admin** and **Sidekick**.

The words *adult*, *kid*, *child*, *member* and *helper* appear nowhere — not in copy, not in type names, not in enum cases, not in analytics events, not in comments. Where they survive in existing code that touches this screen, rename them. `KidRulesView` is a failing build, not a matter of taste.

Sidekick is both the mode and the role: `sidekickCount`, `homeworkProofPerSidekick`, `SidekickMode`.

**The rename is app-wide, not screen-wide.** *Helper* is retired everywhere in ChoreMaxx, confirmed by Cicentos. That work reaches well past this screen and carries one genuine production risk — see **Appendix A**, and read it before running a find-and-replace.

---

## 2. Terms of engagement

1.1 **No rule text in any view file, and no stale copies of the file.** If a string differs between the app and `house-rules.json`, the app is wrong. Bundle the file; do not paste from it. If you have transcribed rule text into a view at any point, delete it rather than correcting it — a corrected transcription drifts again on the next content change.

1. **No rule text in any view file.** If you find yourself typing "7:00 PM" or "Late Credit" into a view, stop — it belongs to the JSON. The only strings a view may hold are chrome: *House Rules*, *Admin*, *Sidekick*, *Edit*, *Settings*, *Ask Poppins*.
2. **No new numbers.** Every figure on this screen resolves from `constants`.
3. **No emoji, in either mode.** Type, colour, badges and bars carry the meaning. This is a brand rule, not a preference.
4. **Invent no copy.** If a state needs a string the JSON does not provide, stop and raise it.
5. **Do not implement partially.** Where you cannot finish something, leave it unbuilt and say so plainly in your summary. A half-finished visual that renders wrongly in silence is worse than one that is absent.
6. **Both modes ship together.** Sidekick is not a follow-up ticket.

---

## 3. Order of work

| Step | Work | Complete when |
|---|---|---|
| 1 | Decode `house-rules.json` into typed models | A test decodes the file and asserts **36 rules across 7 chapters** |
| 2 | `isVisible(condition, household)` | Tests cover all six condition keys |
| 3 | `tok()` token substitution | A test proves an unknown token raises |
| 4 | `visibleRules(household)` — filtered, grouped, ordered | A test proves an `xp_only` household hides the expected ids |
| 5 | `constants` wired to the **existing scoring engine** | See §5 — the highest-risk step in this build |
| 6 | The card list and the fifteen visuals | §7 |
| 7 | Sidekick mode, and the role routing in §8.1 | §8 |
| 8 | Acceptance checklist | §11 |

Steps 1 through 5 carry no interface work at all. Begin there.

---

## 4. The data model

Decode it; do not transcribe it by hand.

```
Rule
  id: String              // permanent — the handle for support, analytics and deep links
  chapter: ChapterKey     // enum
  order: Int
  condition: ConditionKey // enum
  visual: VisualKey       // enum
  editable: Bool
  settingKey: String?     // present if and only if editable is true
  admin:    { headline, clause }
  sidekick: { headline, body }
```

`chapter`, `condition` and `visual` are **closed enums**, and decoding **fails loudly** on any value outside them. There is no silent fallback: a typo in the content file should break a test, never ship a blank card.

The set stands at 36 rules — Earning 6, Deadlines 7, Streaks 4, Crowns 7, Rewards 7, Proof 2, Household 3.

A note on what is absent. Earlier drafts carried a `phase` field and a `question` string on every rule, serving layouts that were not chosen. Both have been removed. Should either be wanted later, the four-layout version is archived — do not reconstruct it from memory.

---

## 5. Constants are shared, never copied

`constants.lateCredit`, `constants.streak` and `constants.streakRescue` describe behaviour the scoring engine already implements. They must not exist twice.

Either the engine reads the same decoded `constants`, or it keeps its own values and a test holds the two together:

```
test_lateCreditTableMatchesScoringEngine()
  for (full, late) in constants.lateCredit:
    assert scoringEngine.lateValue(for: full) == late
```

If that test cannot be written because the engine's values are buried inside a view or a switch statement, **say so and stop.** That is a genuine defect, and it takes precedence over this screen.

---

## 6. Filtering, tokens and voice

### 6.1 Which rules render

| Condition | Household check |
|---|---|
| `ALWAYS` | true |
| `XP_ON` | `rewardModel != .allowance` |
| `ALLOWANCE_ON` | `rewardModel ∈ {allowance, xp_allowance, full_system}` |
| `REWARDS_ON` | `rewardModel ∈ {xp_rewards, full_system}` |
| `MULTI_SIDEKICK` | `sidekickCount >= 2` |
| `SOLO_SIDEKICK` | `sidekickCount == 1` |
| `ALLOWANCE_REQUESTS_ON` | `rewardModel ∈ {allowance, xp_allowance, full_system}` **and** `allowanceRequestsEnabled == true` |
| `HOMEWORK_ON` | `homeworkEnabled == true` |

`MULTI_SIDEKICK` and `SOLO_SIDEKICK` are complements, and that is deliberate: every household sees a Crowns chapter, but a different one. See §6.6.

One function, one switch. No expression parser, and no conditions supplied at runtime.

### 6.2 Chapters that empty out

Where every rule in a chapter is filtered away, the chapter **does not render at all** — no header, no count, no vacant card. Build the behaviour even though no current configuration triggers it: a later rule change can empty a chapter, and the screen must close over the space rather than leave a heading with nothing beneath it.

Crowns no longer empties. A household with one Sidekick sees a shorter Crowns chapter, not an absent one — see §6.6.

### 6.3 Tokens

Copy may carry `{dailyDeadline}` and `{expiryTime}`. The renderer resolves them from `constants` and formats them for the household's locale, in twelve- or twenty-four-hour time.

**An unrecognised token raises.** It never renders blank, and it never leaves braces on screen. This is why no rule hardcodes a clock time; do not undo it.

### 6.4 The header count

`7 chapters · 36 rules` is derived from the visible set, as is each chapter's own count. A household on allowance alone will correctly read a smaller number.

### 6.5 Voice — do not improve the copy

The two modes are written in different registers deliberately, and the difference does real work:

- **Admin** is precise and declarative. One idea to a sentence; no hedging, no padding.
- **Sidekick** is plain and concrete. Short sentences, ordinary words, second person. It is written for a nine-year-old reading it alone, with no adult on hand to interpret.

The Sidekick copy is final as written. Do not raise its register to meet the Admin one, and do not compress Admin clauses into fragments. Should a string read oddly to you, raise it — do not rewrite it.

### 6.6 A solo Sidekick still competes

Earlier drafts hid Crowns from a household with one Sidekick. They no longer do. A solo Sidekick competes **against their own past weeks**: the Week's Crown is won by beating their best week so far, the Monthly Sovereign by beating their best month.

That splits the chapter by household shape rather than hiding it:

| Rule | Condition | Shown to |
|---|---|---|
| `CROWN-01` The Week's Crown, highest XP | `MULTI_SIDEKICK` | two or more |
| `CROWN-02` One Sidekick, still a contest | `SOLO_SIDEKICK` | exactly one |
| `CROWN-03` Gold, silver, bronze | `MULTI_SIDEKICK` | two or more |
| `CROWN-04` Ties share a rank | `MULTI_SIDEKICK` | two or more |
| `CROWN-05` Every sheet is open | `ALWAYS` | everyone |
| `CROWN-06` Champion's Record | `ALWAYS` | everyone |
| `CROWN-07` Trophies run on lifetime XP | `XP_ON` | everyone scoring XP |

Places and ties are genuinely meaningless with one Sidekick, so they stay gated. The weekly sheet and Champion's Record read correctly either way and are now `ALWAYS`.

**The one to get right:** a household that adds a second Sidekick moves from `CROWN-02` to `CROWN-01`, `CROWN-03` and `CROWN-04` — four rules change on the next render, with no migration and no stale copy. A household that drops back to one moves the other way. Neither transition needs special handling if the condition is evaluated at render time; both break if the visible set is cached.

---

## 7. The layout

A single scrolling list of cards, gathered under chapter headers in `chapter.order`, each chapter's rules in `rule.order`.

Each card carries a headline, its visual, and the rule text beneath. The `visual` field selects the component:

| `visual` | Renders | Data source |
|---|---|---|
| `none` | quiet outlined card, text only | — |
| `xpRamp` | six ascending bars | `constants.xpValues` |
| `dayTimeline` | one rail, three markers | `constants.deadlines.daily`, `constants.expiryTime` |
| `lateCreditTable` | two-column table | `constants.lateCredit` |
| `streakDots` | seven dots, two filled | `constants.streak` |
| `rescueTiers` | three tiles | `constants.streakRescue` |
| `podium` | three bars, 2nd / 1st / 3rd | — |
| `modelList` | five rows, active model marked | `constants.rewardModels` |
| `gateSteps` | two-step gate | — |
| `frequencyGrid` | three chips and a More chip | `constants.primaryFrequencies`, `frequencyCount` |
| `trophyScale` | one large figure | `constants.topTrophy` |
| `zeroXpShare` | proportion bar | `constants.library` |
| `inviteFacts` | three small tiles | `constants.invites` |
| `expiryWindow` | one large figure | `constants.expiredPurgeDays` |
| `weekTrend` | four bars, the last marked | — |

Fourteen of the 36 rules carry an illustration; the remaining 22 are quiet cards. **That ratio is deliberate** — the quiet cards are what make the illustrated ones read. Do not add visuals to rules that lack one, and do not give the quiet card a decorative treatment to "balance" the list.

**No visual may contain a literal number that also appears in `constants`.** Every figure is passed in.

Both modes implement every visual. Two of them render as nothing on the Sidekick side (`modelList`, `zeroXpShare`) because the underlying fact is an Admin concern — that is intentional, and the card still shows its headline and text.

---

## 8. Sidekick mode

The same `visibleRules`, the same filtering, the same order, the same chapter grouping. Only the copy and the styling change:

- Chapter header takes `chapter.sidekickLabel`, coloured by `chapter.sidekickColor`
- Cards take `sidekick.headline` and `sidekick.body`
- Visuals take their Sidekick variant

Sidekick mode shows no `settingKey` affordances and no Edit control.

**Sidekick mode is not a preview for the Admin.** It is what a Sidekick sees on their own device, resolved through the same household configuration. Do not build it as a static sample.

### 8.1 A Sidekick has one version, and no switch

This is the part most easily got wrong, so it is stated separately.

| Role | Opens on | Mode switcher | May reach the other version |
|---|---|---|---|
| Admin | Admin version | **Yes** | Yes — they need to see what their household sees |
| Sidekick | Sidekick version | **No** | **No** |

A Sidekick's profile opens **straight into the Sidekick version**. There is no Admin/Sidekick control anywhere in their interface — not disabled, not hidden behind a setting, not tucked into a menu. The screen simply has one state for them.

**This is a routing rule, not a cosmetic one.** Hiding the control is not sufficient. The Admin version must be unreachable from a Sidekick session by every path:

- no deep link resolves to it
- restored state cannot land on it after a relaunch
- no navigation stack retains it from a previous session or account switch
- the mode is derived from the session's role at render time, never held in user-writable storage

Build it so that mode is a **function of role**, not a variable a Sidekick can hold. If `mode` is settable state on a Sidekick's device, the requirement has not been met, however well the control is hidden.

The `modes` block in `house-rules.json` carries this configuration. Read it; do not hardcode the behaviour.

The segmented control on the Admin screen is the Admin's switcher and belongs there. The reference renderer's **top-level** toggle, above the phone frame, is a review control for this document only — it is not app UI, and it must not be reproduced in either build.

---

## 9. The deadline is a household setting

The daily deadline is no longer fixed at 7:00 PM. An Admin sets it, and `house-rules.json` carries the control's definition in `settings.dailyDeadline`. Read it; do not hardcode the range.

| Property | Value | Why |
|---|---|---|
| Default | `19:00` | What every existing household runs today |
| Range | `15:00` to `22:00` | Below 15:00 the deadline falls inside the school day. Above 22:00 the Late Credit window shrinks to under an hour and Late Credit stops meaning anything. |
| Step | 15 minutes | |
| Applies to | daily, weekday, weekly and monthly tasks | One deadline hour for the household, not four |
| Takes effect | the following day | A task in progress never changes value beneath a Sidekick |
| Editable by | Admin | Reached from `DEAD-01`, whose `settingKey` is `deadlines` |

**Expiry is not configurable.** `constants.expiryTime` stays at 23:59: it is the day boundary, not a deadline, and moving it would mean a day that ends at a different time from the calendar's.

Four consequences to build for:

1. **Everything reads the setting, never the default.** `constants.deadlines.default` is a fallback for a household that has never set one. The `{dailyDeadline}` token resolves from the household value first. The renderer shows the pattern.
2. **The Poppins nudge follows it.** The reminder is 30 minutes before the deadline, wherever the deadline sits — not 6:30 PM.
3. **The `dayTimeline` visual is drawn from the actual deadline.** Its markers are positioned by time, not by fixed percentages, so a household on 21:00 sees a long green stretch and a short amber one. That is the point of the visual: it shows the shape of *their* evening.
4. **A change takes effect the next day.** Applying it immediately can reduce the value of a task a Sidekick is midway through — the failure this rule exists to prevent. If the engine cannot defer, stop and say so rather than shipping the immediate version quietly.

Weekly and monthly tasks close on their own days — Sunday and the last Sunday — at the same hour.

---

## 9a. Hold & Request — two requests, two scopes

There are two hold-to-request behaviours and they are **not** the same feature. Gating them together was a mistake in an earlier draft: it told households running XP + Rewards that they could request an allowance amount, when that model has no allowance in it at all.

| Rule | What it covers | Shown when |
|---|---|---|
| `RWRD-03` | Holding a **reward** to request it | `REWARDS_ON` — XP + Rewards, full system |
| `RWRD-07` | Holding an **allowance amount** to request it | `ALLOWANCE_REQUESTS_ON` — Allowance, XP + Allowance, full system, **and** the setting on |

Only the full system shows both. A household on Allowance alone sees the amount request and no reward request; one on XP + Rewards sees the reverse.

### The off switch

`settings.allowanceRequests` disables amount requests. It has two properties worth building carefully:

1. **It only exists where allowance does.** In a household with no allowance model, the setting is **absent** — not present and switched off. There is nothing for it to govern, and a dead toggle invites the question of why it does nothing.
2. **Switching it off removes the behaviour and `RWRD-07` together.** The rule describing a thing a Sidekick cannot do must not remain on their screen. This falls out of the condition automatically; do not special-case it.

### What `RWRD-07` requires

1. **The amount is bounded by the recorded balance.** A Sidekick selects from what has already accrued to them, never a free-typed field. An unbounded input invites a request for a number nobody intended to see. See decision E — this bound rests on an assumption about your allowance model.
2. **The day gate applies.** Tasks and homework complete, exactly as for a reward.
3. **An Admin approves, and no money moves.** ChoreMaxx records the outcome. The control is **Approve now**, and none of *send*, *transfer* or *pay* appears anywhere near it.

---

## 10. The quality floor

- **Visible scrollbars** on this screen and on every picker. This is a household standard, not the platform's auto-hiding default.
- **Dynamic type** up to the largest accessibility size, with no fixed card heights anywhere. The Late Credit table and the XP ramp fail first — test those.
- **Colour is never the sole signal.** Each segment of the timeline carries a text label; the proportion bar carries its figures in text. Keep them.
- **Chapter headers and counts are set at 13px minimum**, in a tone that clears 4.5:1 against the card behind them. The original screen failed on both counts and was hard to read.
- **VoiceOver** reads each card as one element: `{headline}. {clause}`. Ramps, bars, dots, tiles and the podium are decorative and hidden from the accessibility tree — the podium must never be read aloud as "2, 1, 3".
- **Times follow the household locale**, by way of `tok()`. Never hardcode a clock format.

---

## 11. Acceptance checklist

Work through every line, and report pass or fail **individually**. "All done" is not a report.

**Data**
- [ ] The JSON decodes: 36 rules, 7 chapters, 8 conditions, 15 visuals
- [ ] An unknown enum value fails decoding loudly
- [ ] Every rule marked `editable: true` carries a `settingKey`
- [ ] Late Credit agrees with the scoring engine (§5)
- [ ] Grep the target for `\bkid\b`, `\badult\b`, `\bchild\b`, `\bmember\b`, `\bhelper\b`, `\bparent\b` — no hits in user-visible copy
- [ ] Every string on screen matches `house-rules.json` character for character (§0, defect 1)
- [ ] Locked vocabulary survives: *Late Credit*, *Streak Rescue*, *Recess*, *The Week's Crown*, *Monthly Sovereign*, *Champion's Record*, *Mint Reward*, *Hold & Request*, *Approve now*

**Filtering**
- [ ] `xp_only`: allowance rules hidden, Rewards chapter still renders
- [ ] `allowance`: every `XP_ON` rule hidden
- [ ] One Sidekick: the Crowns chapter is absent entirely, and leaves no gap
- [ ] `homeworkEnabled == false`: `PROOF-02` hidden, Proof chapter still renders
- [ ] Header count and per-chapter counts reflect the visible set

**Tokens**
- [ ] A resolved token is styled exactly like the text around it — no chip, badge, box or accent (§0, defect 3)
- [ ] The whole placeholder is replaced, braces included — not the leading digits (§0, defect 2)
- [ ] A twelve-hour household reads `DEAD-01` as "7:00 PM"
- [ ] A twenty-four-hour household reads the same rule as "19:00"
- [ ] An unknown token raises rather than rendering blank

**Render**
- [ ] All fifteen visuals implemented in both modes
- [ ] Grep view files for "7:00", "Late Credit", "100,000" — no hits
- [ ] No emoji in either mode
- [ ] 22 quiet cards, 14 illustrated — no visuals added or removed

**Deadline setting (§9)**
- [ ] The picker offers 15:00 to 22:00 in 15-minute steps, read from `settings.dailyDeadline`
- [ ] A household that has never set one reads 19:00
- [ ] Changing it updates every rule that carries `{dailyDeadline}`, in both modes
- [ ] The Poppins nudge moves with it — 30 minutes before the set time, not 6:30 PM
- [ ] The `dayTimeline` markers move with it
- [ ] Weekly and monthly tasks close at the new hour on their own days
- [ ] A change made today applies tomorrow; a task in progress keeps its value
- [ ] Expiry stays at 23:59 and has no control anywhere

**Crowns by household shape (§6.6)**
- [ ] One Sidekick: Crowns renders with `CROWN-02`, `CROWN-05`, `CROWN-06`, `CROWN-07` — not hidden
- [ ] Two Sidekicks: `CROWN-02` disappears and `CROWN-01`, `CROWN-03`, `CROWN-04` appear
- [ ] Adding a second Sidekick flips those four rules on the next render, with no relaunch and no cached set

**Requests, by model (§9a)**
- [ ] XP only: neither `RWRD-03` nor `RWRD-07` renders
- [ ] Allowance: `RWRD-07` renders, `RWRD-03` does not
- [ ] XP + Rewards: `RWRD-03` renders, `RWRD-07` does not — and no copy on screen mentions allowance
- [ ] XP + Allowance: `RWRD-07` renders, `RWRD-03` does not
- [ ] Full system: both render
- [ ] `allowanceRequests` off: `RWRD-07` disappears and the gesture stops working together
- [ ] The `allowanceRequests` control is absent — not disabled — in a household with no allowance model
- [ ] A Sidekick can request an amount, bounded by their recorded balance, never free-typed past it
- [ ] The request is blocked, with the finish-the-day prompt, until tasks and homework are complete
- [ ] The request reaches an Admin for approval; nothing auto-grants
- [ ] No instance of *send*, *transfer*, *pay* or *payment* anywhere in the flow

**Role and routing (§8.1)**
- [ ] A Sidekick session opens directly on the Sidekick version
- [ ] No mode switcher appears anywhere in a Sidekick session
- [ ] A deep link to the Admin version, opened by a Sidekick, does not render it
- [ ] Relaunching after force-quit returns a Sidekick to the Sidekick version
- [ ] Switching from an Admin account to a Sidekick account leaves no Admin view in the stack
- [ ] `mode` is derived from session role, not read from user-writable storage
- [ ] An Admin can still switch to the Sidekick version and back

**Quality**
- [ ] Nothing clips at the largest dynamic type
- [ ] The scrollbar is visible
- [ ] Chapter headers meet the size and contrast floor in §10
- [ ] VoiceOver reads each card once and skips decorative elements
- [ ] Sidekick mode reflects household configuration, not a static sample

---

## 12. What must not happen

- Do not rename: *Late Credit*, *Expired*, *Streak Rescue*, *Recess*, *House Rules*, *The Week's Crown*, *Monthly Sovereign*, *Champion's Record*, *Mint Reward*, *Hold & Request*, *Approve now*, *Admin*, *Sidekick*.
- Do not write *send*, *transfer*, *pay* or *payment* anywhere near allowance. ChoreMaxx **records** allowance; it moves no money. The control is **Approve now**.
- Do not add, remove or reword a rule. Content changes come from Cicentos.
- Do not let this screen reach the network.
- Do not reorder chapters or rules to improve the flow.
- Do not render a mode switcher in a Sidekick session — disabled, hidden or otherwise (§8.1).
- Do not store the current mode anywhere a Sidekick's device can write to it.
- Do not style a resolved token differently from the sentence containing it.
- Do not hardcode 7:00 PM, or the deadline range, anywhere. Both come from the file.
- Do not make expiry configurable.
- Do not add onboarding tooltips, celebratory animation, or a summary card.
- Do not reintroduce the layouts that were removed, in whole or in part.

---

## 13. Decisions — resolved, and what remains

**A. Is the Late Credit table Admin-editable? — Decided: no, it stays locked.**

You left this to me, so here is the reasoning rather than just the answer. Three things argue against opening it. The table is coupled to the scoring engine, and every household-editable copy of a value is a new way for the two to drift — §5 exists because that drift has already happened once. Six editable fields is a disproportionate amount of interface for a value most households will never touch. And Late Credit is a fairness promise a Sidekick relies on: an Admin who lowers it mid-week changes the value of work already planned around it.

What would change my mind is evidence that households want *harsher or gentler* late penalties — not that they want to hand-edit six numbers. If that demand appears, the right shape is a single control with three presets — Lenient, Standard, Strict — each mapping to a whole table the engine already knows. That keeps one source of truth and one migration path. It is a later release, not this one.

**B. Should Crowns hide for a one-Sidekick household? — Decided by you: no.** A solo Sidekick competes against their own past weeks. Built as §6.6.

**C. Should Hold & Request cover allowance? — Decided by you: yes, and scoped.** A Sidekick selects an amount and holds to request it, in Allowance, XP + Allowance and full system only. An Admin can switch it off, which removes the behaviour. Built as §9a. My first pass gated it on any model but XP-only, which wrongly reached XP + Rewards — corrected.

**D. Is 15:00–22:00 the right deadline range? — Confirmed by you.** No change.

### What remains

**E. Is the recorded balance the right ceiling on an allowance request?** *Still open, and the last thing blocking `RWRD-07`.* I have bounded requests by what a Sidekick has already accrued, because an open amount field is an invitation. But if allowance in your model is a weekly figure an Admin approves rather than a running balance, there may be no balance to bound against — in which case the ceiling should be the week's figure, or a cap you set per Sidekick. Tell me which of the three it is and I will adjust `RWRD-07`.

**F. What happens to a pending amount request when an Admin switches requests off, or changes the reward model away from allowance?** The rule vanishes from the screen correctly, but a request already sitting in the Admin's queue does not vanish with it. I would cancel pending requests and tell the Sidekick once, rather than leave them waiting on something that can no longer be approved — but say if you would rather they resolve first.

**G. Does a solo Sidekick's Champion's Record show crowns, or personal bests?** `CROWN-06` now shows to everyone, but a solo household's crowns are self-referential. If the Record should read differently for them — *"best week: 240 XP"* rather than a list of crowns — that is a second `SOLO_SIDEKICK` variant and I will write it.

---

# Appendix A — retiring *Helper* app-wide

*Helper* is replaced by **Sidekick** throughout ChoreMaxx. This appendix sits outside the House Rules screen and applies to the whole product.

**Do not begin with a global find-and-replace.** One category of occurrence must not be changed, and a blind sweep will change it. Read §A.2 first.

## A.1 Rename everywhere — the safe surfaces

Every one of these is user-visible or developer-facing, and none of them is persisted. Rename all of them:

- **Interface copy** — labels, buttons, section headers, empty states, error messages, confirmation dialogs, permission explanations
- **Type and symbol names** — `HelperRole`, `helperCount`, `isHelper`, `HelperListView`, `helpers` collections, function and variable names, test names
- **Comments and documentation** — inline comments, README files, code docs
- **Notification copy** — push notifications, in-app notifications, anything Poppins says
- **Invite flows** — the invite sheet, the share text, the invite email or SMS body, the landing page a link opens
- **Onboarding** — role selection, household setup, any explanation of what the two roles do
- **Settings** — members management, role pickers, permission descriptions
- **App Store listing** — description, keywords, screenshot captions, What's New
- **Support material** — help pages, FAQs, the support site, canned support replies

Sidekick is capitalised as a role name, exactly as Admin is: *"Invite a Sidekick"*, not *"invite a sidekick"*.

## A.2 The one place to be careful — persisted values

If a role is stored anywhere as the literal string `helper` — in the database, in a user document, in a cached payload, in `UserDefaults`, in a JWT claim, in a server response — **that stored token is not copy. It is a key.**

Change the enum's *name* and leave its *raw value* alone:

```
enum Role: String {
  case admin    = "admin"
  case sidekick = "helper"   // storage token, deliberately unchanged — see Appendix A.2
}
```

Renaming the raw value instead means every household created before this release has a role that no longer decodes. Depending on how the failure is handled, existing Sidekicks either lose their access or silently gain Admin permissions. Neither is acceptable, and neither shows up in a simulator on a fresh account.

If the token genuinely must change, it needs a deliberate migration: write both values for a release, read both indefinitely, and only then stop writing the old one. **That is a separate ticket with its own testing, not part of this rename.** Do not attempt it inside this change.

The same caution applies to:

- **Analytics event names and properties.** Renaming `helper_invited` to `sidekick_invited` severs the metric's history. Either keep the event key and rename only its display label, or rename it and annotate the break in the dashboard on the release date. Decide deliberately; do not let a find-and-replace decide for you.
- **Server-side enums and API contracts.** If the client and server disagree about the token, roles break in production but not in local testing.
- **Deep link paths** already in the wild — `/invite/helper/...` links live in people's messages for seven days after they are sent.

## A.3 Acceptance

- [ ] Grep the whole target for `\bhelper\b`, case-insensitive — every remaining hit is a persisted token carrying the Appendix A.2 comment, and nothing else
- [ ] Grep for `\bHelper\b` in type and symbol names — no hits
- [ ] An account created **before** this build still loads, with its role intact and its permissions unchanged
- [ ] An invite link generated before this build still resolves and still assigns the right role
- [ ] Push notification copy reads *Sidekick*
- [ ] Invite email and share text read *Sidekick*
- [ ] Role picker and members management read *Sidekick*
- [ ] Analytics decision recorded in the PR description — key kept, or key renamed and break annotated
- [ ] App Store listing and screenshot captions updated in the same release, not a later one

## A.4 Sequence

1. Rename symbols and types, leaving raw values untouched.
2. Rename interface copy, notifications, invites and onboarding.
3. Run the greps in A.3.
4. Test against an account created before the change — this is the step that catches the §A.2 mistake, and a fresh simulator account will not.
5. Update store listing and support material to land with the release.

If step 4 cannot be run because no pre-change account is available in your environment, **say so rather than marking it passed.**
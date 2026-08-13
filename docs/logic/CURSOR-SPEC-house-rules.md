# House Rules — implementation spec

**Read this whole file before writing code. Do not start with the UI.**

This screen has failed in the past because rule text lived inside views. It doesn't anymore. `house-rules.json` is the only place rule copy exists. Your job is to build a renderer over it, not to write a screen.

---

## 0. Rules of engagement

1. **No literal rule text in any view file.** If you catch yourself typing "7:00 PM" or "Late Credit" into a view, stop — it comes from `house-rules.json`. The only strings allowed in views are UI chrome: `House Rules`, `Adult`, `Kid`, `Edit`, `Search the rules`, `Settings`.
2. **No new numbers.** Every figure on this screen resolves from `constants`. Do not hardcode `10` for the bundle bonus or `0.10` for Streak Rescue.
3. **No emoji anywhere**, in either mode. Meaning is carried by type, colour, badges and bars. This is a brand rule, not a preference.
4. **Do not invent copy.** If a state needs a string that isn't in the JSON, stop and flag it rather than writing your own.
5. **Do not partially implement.** If you can't finish a section, leave it unbuilt and say so explicitly in your summary. A half-built visual that silently renders wrong is worse than a missing one.
6. **Both modes ship together.** Adult and Kid are one feature. Kid is not a follow-up ticket.

---

## 1. Build order

Build in this sequence. Do not skip ahead to the layout.

| Step | What | Done when |
|---|---|---|
| 1 | Decode `house-rules.json` into typed models | A unit test decodes the file and asserts 29 rules, 7 chapters |
| 2 | `isVisible(condition, household)` resolver | Unit tests cover all 6 condition keys |
| 3 | `visibleRules(household)` → filtered, chapter-grouped, ordered | Test: `xp_only` household hides 4 rules |
| 4 | `constants` wired to the **existing scoring engine** | See §3 — this is the highest-risk step |
| 5 | The chosen layout | §5 |
| 6 | Kid mode over the same data | §6 |
| 7 | Acceptance checklist | §9 |

---

## 2. Data model

Decode, don't hand-write. Types map 1:1 to the JSON keys.

```
HouseRules
  schemaVersion: String
  constants: RuleConstants
  chapters: [Chapter]
  rules: [Rule]
  footnotes: Footnotes

Rule
  id: String              // stable forever — used for support and deep links
  chapter: ChapterKey     // enum
  order: Int
  condition: ConditionKey // enum, closed set
  phase: PhaseKey         // enum, closed set — required, never nil
  visual: VisualKey       // enum, closed set
  editable: Bool
  settingKey: String?     // present only when editable == true
  adult: AdultCopy        // headline, question, clause
  kid: KidCopy            // headline, question, body
```

`condition`, `phase`, `visual` and `chapter` are **closed enums**. Decoding must **fail loudly** on an unknown value — do not fall back to a default. A typo in the content file should break a test, not ship a blank card.

---

## 3. Constants must be shared, not copied

`constants.lateCredit`, `constants.streak` and `constants.streakRescue` describe behaviour the scoring engine already implements.

**Do not duplicate them.** Pick one:

- **Preferred:** the scoring engine reads from the same decoded `constants` object.
- **Acceptable:** the engine keeps its own values, and a test asserts they are equal to the JSON.

Add this test either way:

```
test_lateCreditTableMatchesScoringEngine()
  for each (full, late) in constants.lateCredit:
    assert scoringEngine.lateValue(for: full) == late
```

If this test can't be written because the engine's values are buried in a view or a switch statement, **say so and stop** — that's a real bug and it outranks this screen.

---

## 4. Visibility and numbering

### 4.1 Filtering

A rule renders only when `isVisible(rule.condition, household)` is true.

| Condition | Household check |
|---|---|
| `ALWAYS` | always true |
| `XP_ON` | `rewardModel != .allowance` |
| `ALLOWANCE_ON` | `rewardModel ∈ {allowance, xp_allowance, full_system}` |
| `REWARDS_ON` | `rewardModel ∈ {xp_rewards, full_system}` |
| `MULTI_MEMBER` | `helperCount >= 2` |
| `HOMEWORK_ON` | `homeworkEnabled == true` |

Implement this as **one function with a switch**. Do not build a string-expression parser. Do not accept conditions from the server.

### 4.2 Empty chapters

If every rule in a chapter is filtered out, **the chapter does not render at all** — no header, no spine, no empty card. A one-child household loses the whole Crowns chapter; the screen must not leave a gap where it was.

### 4.3 Clause numbers — the trap

Direction 01 shows numbers like `2.3`. **These are display values computed at render from the visible list**, never stored and never written into copy.

```
displayNumber = "\(chapter.order).\(indexInVisibleChapterRules + 1)"
```

Consequence, and this is intentional: `2.3` refers to different rules in different households. That's why `rule.id` exists. **Support, analytics, deep links and bug reports use `rule.id` (`DEAD-03`), never the display number.** If you're about to log a display number, log the id instead.

### 4.4 The rule count in the header

`7 chapters · 29 rules` is computed from the visible set, not hardcoded. An allowance-only household will correctly read fewer.

---

## 5. Layout — the chosen direction

> **Blocked until Cicentos confirms which of the four ships (§10, decision A).** Build steps 1–4 first; they're identical for all four.

All four render the same `visibleRules`. Only presentation differs.

### 01 Chapters
Group by chapter, ordered. Spine label = `chapter.adultLabel`, rotated. Count line = `Chapter {order} · {n} rules`. Numbers per §4.3. `DEAD-03` additionally renders the Late Credit pills beneath its clause, built from `constants.lateCredit`.

### 02 At a glance
One card per rule, grouped under `chapter.adultLabel` headers. `visual` selects the component:

| `visual` | Component | Data source |
|---|---|---|
| `none` | Quiet outlined card | — |
| `xpRamp` | Six ascending bars | `constants.xpValues` |
| `dayTimeline` | Rail with three markers | `constants.deadlines.daily`, `constants.expiryTime` |
| `lateCreditTable` | Two-column table | `constants.lateCredit` |
| `streakDots` | Seven dots, two filled | `constants.streak` |
| `rescueTiers` | Three tiles | `constants.streakRescue` |
| `podium` | Three bars | — |
| `modelList` | Five rows, active highlighted | `constants.rewardModels` + `household.rewardModel` |

Every visual takes its numbers as parameters. **No component may contain a literal number that also appears in `constants`.**

### 03 The Track
Two blocks. Group rules by `phase`, order by `phases[key].order`, split on `phases[key].block` (`day` then `beyond`).

- Gutter text = `phases[key].gutter`; kicker = `phases[key].kicker`.
- Node colour = `phases[key].tone` (`normal` olive, `hot` ember, `dead` muted red, `gold` amber).
- Several rules share a phase — they render as **separate stops under a repeated gutter label**, or merged into one stop with multiple paragraphs. Pick merged; it reads better at this density.
- **If a phase group ends up empty, the stop does not render.** The connector line must join the surviving stops with no gap.
- **This is the direction that breaks when rules are added.** Every new rule must declare a phase. `anytime` is the escape hatch and lands in the "Beyond the day" block. Add a decode test asserting no rule has a nil phase.

### 04 Ask Poppins
`adult.question` is the heading, `adult.clause` the body, grouped by chapter under `chapter.adultLabel`.

Search is **required for this direction to be worth shipping** — as a static list it's just an FAQ and 01 does that better. Search must match against `question`, `clause` and `chapter.adultLabel`, be diacritic- and case-insensitive, and show a result count. Empty state copy: `No rule matches that. Try "late", "streak" or "allowance".`

---

## 6. Kid mode

Same `visibleRules`, same filtering, same order. Swap the copy source:

- Chapter label → `chapter.kidLabel`, colour → `chapter.kidColor`
- Direction 01/02/03 → `kid.headline` + `kid.body`
- Direction 04 → `kid.question` as the outgoing bubble, `kid.body` as Poppins' reply

Kid mode never shows clause numbers, never shows `settingKey` affordances, and never shows the Edit control.

**Kid mode is not a preview for the parent.** It is what the child sees when they open House Rules on their own device, and it must reflect *their* household's config through the same resolver. Do not build it as a static sample.

---

## 7. Quality floor

- **Visible scrollbars** on this screen and every picker (household standard — do not use the platform's auto-hiding default).
- **Dynamic type** to the largest accessibility size. No fixed card heights anywhere. Test the Late Credit table and the XP ramp at the largest setting — those two break first.
- **Colour is never the only signal.** The timeline's green/amber/red segments each carry a text label. Keep them.
- **Reduced motion respected** — the mode-switch transition must be a cross-fade or nothing.
- **VoiceOver:** each rule is one element reading `{headline}. {clause}`. Decorative bars and dots are `.isHidden` / not accessible. The podium is not read as "2, 1, 3".
- **Times render in household locale** — a 24-hour household sees `19:00`, not `7:00 PM`. `constants.deadlines` stores 24-hour; format at the edge. **This affects `kid.headline` for `DEAD-01`, which contains "7:00 PM" as literal text — see §10, decision D.**

---

## 8. What Cursor must not do

- Do not rename `Late Credit`, `Expired`, `Streak Rescue`, `Recess`, `House Rules`, `The Week's Crown`, `Monthly Sovereign`, `Champion's Record`, `Mint Reward`, `Helper`. These are locked.
- Do not write "send", "transfer", "pay" or "payment" anywhere near allowance. ChoreMaxx records allowance; it does not move money. The control is **Approve now**.
- Do not add a rule to the JSON. Content changes come from Cicentos.
- Do not make this screen fetch from the network.
- Do not reorder chapters or rules to "improve flow".
- Do not add an onboarding tooltip, a celebration animation, or a summary card.

---

## 9. Acceptance checklist

Run every line. Report pass/fail individually — not "all done".

**Data**
- [ ] JSON decodes; 29 rules, 7 chapters, 6 conditions, 10 phases, 8 visuals
- [ ] Unknown enum value in the JSON fails decoding loudly
- [ ] No rule has a nil `phase`
- [ ] `editable: true` rules all carry a `settingKey`
- [ ] Late Credit matches the scoring engine (§3 test)

**Filtering**
- [ ] `xp_only` household: allowance rules hidden, Rewards chapter still renders (RWRD-01 survives)
- [ ] `allowance` household: all `XP_ON` rules hidden
- [ ] One-helper household: Crowns chapter absent entirely, no gap
- [ ] `homeworkEnabled == false`: PROOF-02 hidden, Proof chapter still renders
- [ ] Header count reflects the visible set, not 29

**Render**
- [ ] Clause numbers contiguous with no gaps after filtering
- [ ] No literal rule text found in view files (grep for "7:00", "Late Credit", "100,000")
- [ ] No emoji in either mode
- [ ] Track: no empty stops, connector line unbroken

**Quality**
- [ ] Largest dynamic type: nothing clipped, table and ramp still readable
- [ ] Scrollbar visible
- [ ] VoiceOver reads each rule once, skips decorative elements
- [ ] Reduced motion honoured
- [ ] Kid mode reflects household config, not a static sample

---

## 10. Open decisions — need Cicentos before build

**A. Which direction ships.** Steps 1–4 are unblocked and identical either way, so start there. 01 is the safest to build and scales best; 03 is the strongest teaching tool but the most fragile; 04 needs working search to justify itself.

**B. Do rule changes apply immediately or next day?** The footnote currently promises next-day. If the engine applies changes immediately, a task's value can shift while a kid is mid-task — which is the kind of thing kids notice and parents get blamed for. Confirm the real behaviour; if it's immediate, the footnote comes out of the JSON.

**C. Is the Late Credit table admin-editable?** Currently `editable: false`. Locked is the right call for v2 — it keeps the table consistent with the scoring engine — but confirm.

**D. `DEAD-01`'s kid headline contains "7:00 PM" as literal text.** For a 24-hour household it will read wrong. Two options: split the time out as a token the renderer substitutes (`The bell rings at {dailyDeadline}`), or accept it and ship English/12-hour only for v2. I'd take the token — it's ten minutes now and a content migration later.

**E. Confirm `helperCount >= 2` is the right gate for Crowns.** A single-child household loses six rules and the whole chapter. That's correct if crowns are hidden in-app for one kid — but if a solo kid still competes against their own past weeks, the gate is wrong and those rules should show.

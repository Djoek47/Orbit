# IUI design spec — the canvas, written out

Companion to work order 12. This is the canvas in numbers, so Cursor can build the screens without
opening the design file. Frames are 402 × 874 (iPhone 17 Pro, the tester's device).

Every value below is a token from `constants/iui-stage.ts` (WO12 §A1) or the existing theme. If a value
here is not in a token file, put it in one first.

---

## 1. The shell every stage screen shares

| Part | Spec |
|---|---|
| Ground | `background.base` — dark `#070D1C`, light `#F0F4F8` |
| Ambient glow | one circle, 620 px, centred, 96–150 px from the top, domain colour at 6–7% opacity. One only. |
| Header | 54 px top inset, 22 px side. Left: 7 px domain dot + state in caps (11 px, +1.3 tracking, `#9DB4D2`). Right: "86 LEFT" in the same style, `#6E88AA`. |
| Stage | centred column, 22 px side gutters, 18–24 px between blocks |
| Said line | the person's words, 14/19, `#9DB4D2`, centred, max 310 px, in quotes |
| Dock | 30 px bottom padding. Keyboard 54 × 54 (radius 18), mic 82 × 82 (radius full, `#2F9E74`, 3 px ring at 28% mint, shadow `0 10 30 rgba(47,158,116,0.35)`), teaching "?" 54 × 54. 20 px gaps. |

Light mode swaps: card `rgba(255,255,255,0.92)`, text `#0B1B2E`, muted `#46617F`, mint → `#0F6F55`,
success → `#059669`, shadow `0 14 40 rgba(15,28,42,0.10)`.

## 2. The card

```
ring        2 px, domain colour @ 50%, radius 30, padding 5   ← only while a hold is armed
card        radius 25, surface.card (5% white), 1 px border 8% white
kicker row  16 px 18 px 10 px — domain icon 16 px + DOMAIN in caps (11/+1.2) + right count 12 px
body        rows or slots, 10 px side padding, 3 px between rows
footer      12 px 18 px 14 px, top border 6% white — hold line + two 12 px labels
```

Hold line: 3 px tall, radius full, track 8% white, fill the domain colour, width = progress.
Labels: left "One hold for all three" (`#9DB4D2`), right "tap × to drop one" (`#6E88AA`).

## 3. The row

| Element | Spec |
|---|---|
| Container | radius 17, 13 px 12 px, `surface.row` 3% white; the focused/last row 6% |
| Leading state | 24 px circle. Committed: mint 16% fill + 13 px check, 3 px stroke. Pending: 1.5 px ring at 20% white. Failed: danger ring. |
| Title | 19/24 semibold |
| Trailing detail | 12 px `#6E88AA` |
| Drop button | 44 × 44 touch target with a 30 px visible circle inside, 1 px border 12% white, 12 px × glyph |

## 4. Screen by screen

### 4.1 One item (`grocery_add`, single)

Object tile inside the card: 54 px rounded square (radius 18, mint 14% fill, 22% border) holding a
24 px outline icon; then title 30/34 at −0.4 tracking, detail 13/18 `#9DB4D2`.
Two buttons under the card: "Add now" (mint fill, `#061424` text) and "Not that" (5% white).
Both 44 px minimum height, radius full, 12 px 20 px padding.

### 4.2 Three items, one hold (`grocery_add`, N)

Kicker "GROCERIES" + "3 items". Three rows: two committed, one pending. One hold line for all three.
Below the card, the queue row: radius 20, 1 px dashed 14% white, 13 px 15 px, containing a 26 px mint
tile, "NEXT, ON ITS OWN CARD" (11 px caps `#6E88AA`) over "Dishes → Mia · tomorrow" (14 px `#C8D8F0`),
and a 44 px drop button.

### 4.3 A chore (`task_compose`)

Header block: 52 px domain tile + title 24/29 (−0.3) + detail "Kitchen & dining · 10 min · 15 XP".
Then a 1 px divider, then the slot blocks **in the order the person said them** (WO12 §C).

- Filled slot: domain tint 10%, 1 px border at 30%, label in caps 10 px on the left (42 px column),
  value 15 px semibold.
- Focused slot: 1 px dashed 20% white, its chips visible — faces (4 × 40 px monogram circles in a row,
  selected one at 2 px mint border) or day chips (13 px, radius full, selected = mint fill).
- Later slots: dimmed, no chips.

Proof toggle sits in a 2% white strip at the bottom of the card, 46 × 28 switch.

### 4.4 Calendar event (`calendar_zoom`)

Date block 58 × 62 (radius 16, violet 14%): weekday 10 px caps, day 24 px, month 10 px.
Title 22/27, detail "Noah · 4:30 – 5:15 PM".
Two info rows with 16 px outline icons: place, and leave-by with drive time.
Chips: "Remind 1h before" (violet fill), "Add travel", "Tell Ama".
Day strip: 44 px tall, 6 bars, this event violet at 55%, other commitments 7% white, a gold bar for a
rewards-coloured item; one line under it saying what it clashes with, or what it doesn't.

### 4.5 A trip (`itinerary_stage`)

Title 20/25 + "6 stops · 5h 40m".
Rail: 14 px column, 9 px dot at each end (first filled violet, last a 2 px ring), 2 px gradient line.
Stop row: time 12 px semibold in a 46 px column, then label 15/20 semibold with the place line under it
at 12 px.
A shop stop is mint-tinted (8% fill, 28% border) and its place line reads "Your list comes along · N items".
An unresolved stop is warning-tinted and its line reads "Which address? tap to set" — **it does not block
the hold**.
Chips under the rail: Reorder · Add a stop · Tomorrow.

### 4.6 Settled (WO13 — orb is the tick)

The Poppins orb above the stage is the success mark — sizes 196 / 72 / 34, liquid water, month rim.
On settle (and for the full ~5s undo window) the same orb uses the success tint + check; **never** a
second 108 px success circle under the stage. Drain dashed line is off while success is showing.

Stage result UI is copy + undo ledger only (`IuiResultMark`):
"All set" 32/38 at −0.5 in success text, then one sentence naming what happened, 15/21.
A 6 px-padded ledger card listing each act with its own Undo (44 px target).
Then the turn pill: "Undo all four" + a 28 px ring with two success-coloured quadrants counting down.
Footer line: "Five seconds, then the stage clears."

### 4.7 Show me how (`coach_steps`)

Kicker "PROOF ON A CHORE" in `#6FA8E8`. Answer line 21/27. Three numbered steps, each a 12 px row with a
26 px numbered circle (cyan 18% fill, `#9BC6F5` text) and a chevron on the steps that navigate.
Footer strip in cyan 8% with a top border: "Walk me through it" (filled `#6FA8E8`, `#061424` text) and
"Just do it" (6% white).
Under the card, a dashed note: teaching costs no actions.

### 4.8 Walking you there (coach spotlight)

The real screen at 32–35% opacity behind a `rgba(3,8,16,0.62)` scrim.
Spotlight: the real control at full opacity, 2 px `#6FA8E8` border, radius 22, plus
`0 0 0 6px rgba(55,138,221,0.14)` and a deep drop shadow.
Coach card floats below it: `rgba(13,24,42,0.94)`, radius 24, 1 px 10% white,
shadow `0 24 60 rgba(3,8,16,0.7)`. "STEP 2 OF 3" + three 18 × 3 progress bars.
Buttons: "Do it for me" (filled) and "Next".
Top-left "Back" pill, top-right "Stop the tour" pill, both 40 px minimum.
Bottom: a gradient veil with "or say 'do it for me'".

### 4.9 Trouble states

All four inside the standard card, with an 11 px caps label above each:

| State | Content |
|---|---|
| A slot is missing | Question 20/26, one line of why, three suggestion chips |
| Nothing heard | 44 px muted tile with a crossed-mic icon, title 17/22, honest reason, "Again" button (mint) |
| A row failed | Danger card: 6% fill, 32% border. Title with a 19 px alert icon, a line naming what did save, "Retry bread" (`#F0A0A0` fill, `#2B0B0B` text) and "Leave it" |
| The model is down | Normal card, the act's own confirmation as the title, one line saying the talking part is offline |

Bottom of the board, a mint note carrying the rule: never a failure sentence on a turn where the stage
shows a success.

## 5. Motion

| Moment | Motion |
|---|---|
| Card in | `motion.smooth` — fade + 8 px rise, ≤150 ms after the words end |
| Row in | `motion.smooth`, 40 ms stagger, max 3 staggered then instant |
| Hold | line fills over 850 ms (kids 1300); card breathes to 1.045 on `motion.snappy`, repeating |
| Cancel | line resets over 150 ms, no bounce |
| Settle | `motion.settle` — check draws, card recedes 2%, one success haptic |
| Row commit | its state dot swaps to a check on `motion.snappy` as its write lands |
| Queue | the dimmed row rises into place on `motion.smooth` when its turn comes |
| Spotlight | scrim fades 300 ms, the ring scales from 1.06 on `motion.settle` |

Reduce Motion: every move becomes a cross-fade; durations unchanged. Nothing slides horizontally.
One haptic per card — light on show, success on settle — never per row.

## 6. What the colours mean (fixed, never themed)

| Colour | Where |
|---|---|
| Mint `#76C4AE` | chores, homework, groceries — the doing |
| planPurple `#A78BFA` | events, trips, places |
| rewardsGold `#FAC775` | rewards, allowance, ranks |
| Cyan `#378ADD` | home, household, teaching |
| poppinsCyan `#06B6D4` | the Poppins tab itself, nowhere else |
| success `#34D399` / warning `#FB923C` / danger `#F87171` | done / needs attention / failed |

A member's personal accent pack never repaints these. Domain colour says which part of the app this is;
the accent says which person you are.

## 7. Never

A card inside a card. A spinner where a card could show what it already has. A person's face on a grocery.
Two cards for one sentence. A failure line over a finished act. A colour used for decoration.
Text below 4.5:1 — on the stage, muted text is `#9DB4D2` dark / `#46617F` light, and `#4B6080` is
decoration only.

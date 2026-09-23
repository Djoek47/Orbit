# Work order 12 — Build the IUI stage: scaffolding for every screen in the canvas

For Cursor. Branch **`cursor/make-v23`**, tip `17645a3`. Runs after work orders 10 and 11.

The design canvas is the source of truth for how each of these looks. This document is the source of
truth for what to build, where it lives, and how it behaves. Where they disagree, ask before guessing.

Confirm each claim against the code before you change it. Mismatches go in the flag-back as:
claim → what the code actually does → what you did.

---

## Part A — The foundation (do this first, nothing else works without it)

### A1. One stage design module

New `constants/iui-stage.ts`. Every stage component reads from it; no component hardcodes a hex again.

```ts
export const STAGE = {
  domain: {                    // fixed, never repainted by a member's accent pack
    chores:   '#76C4AE',       // tasks, homework, groceries — the doing
    plan:     '#A78BFA',       // events, trips, places
    rewards:  '#FAC775',       // rewards, allowance, ranks
    household:'#378ADD',       // home, people, teaching
  },
  semantic: { success: '#34D399', warning: '#FB923C', danger: '#F87171' },
  surface:  { card: 'rgba(255,255,255,0.05)', row: 'rgba(255,255,255,0.03)', rowActive: 'rgba(255,255,255,0.06)' },
  radius:   { row: 17, card: 25, ring: 30, pill: 999 },
  ringWidth: 2,
  timing:   { show: 150, hold: 850, holdKid: 1300, settle: 600, undo: 5000 },
} as const;
```

Light values come from `orbitColorsLight` via `useOrbitColors()` — the stage must not be dark-only.
Domain colour is chosen by the beat's scene, in one function: `stageAccent(scene, write)`.

### A2. One card shell

New `components/orbit/poppins-stage/iui-card.tsx` — the shell every scene renders inside:

- kicker row: domain icon + domain name in caps (11 / +1.3 tracking, domain colour) and an optional
  right-hand count ("3 items");
- body (children);
- footer: the hold line (3 px track, domain-coloured fill) and two small labels;
- the whole thing wrapped in the accent ring (2 px, domain colour at 50%) only while a hold is armed.

`iui-stepper.tsx` and `iui-hold-ring.tsx` fold into this. Delete them once nothing imports them.

### A3. One row

New `components/orbit/poppins-stage/iui-row.tsx`: a 19/24 semibold title, optional trailing detail,
a leading state dot (pending ring / committed check / failed), and an optional 44 px × button.
Grocery items, trip stops, batch tasks and the settle summary all use it.

**Rule to enforce in review: a card never contains a card.** Rows are tints, never bordered cards.

---

## Part B — Screen by screen

Each board in the canvas maps to one scene. Build in this order.

| Canvas board | Scene | Files |
|---|---|---|
| One item | `grocery_add`, 1 item | `iui-card` + one `iui-row`, poppins-stage grocery branch |
| Three items, one hold | `grocery_add`, N items | same card, `payload.items[]` (WO11 §2.3) |
| A chore, slot in focus | `task_compose` | `task-compose-steps.tsx` rewritten against §C |
| Calendar event | `calendar_zoom` | new `iui-event-card.tsx` |
| A trip, six stops | `itinerary_stage` | new `iui-trip-card.tsx` |
| Done + undo the turn | settle state | `iui-result-mark.tsx` rewritten, turn ledger from WO11 §2.5 |
| Show me how | `coach_steps` (new) | new `iui-coach-card.tsx`, §D |
| Walking you there | coach spotlight | reuses `components/orbit/tour/*`, §D |
| Trouble states | four states | §F |
| Daylight | all of the above | light palette, no separate components |

### B1. Event card (`iui-event-card.tsx`)

A date block (weekday / day / month), title, who and time; then place and leave-by rows; then chips
(remind, add travel, tell someone); then a small "that afternoon" strip showing the day's other blocks
with this one highlighted, and one line saying whether it clashes.

The clash line is computed on device from `household.events` — never asked of the model.

### B2. Trip card (`iui-trip-card.tsx`)

A vertical rail with a dot per stop, one `iui-row` per stop showing time, label and place line. A stop
whose place did not resolve shows a warning-coloured "Which address?" affordance and **does not block the
hold**. A shop stop shows "Your list comes along · N items" when the grocery list is not empty.

Stops come from WO10 Part D's `create_itinerary` with `stops[]`. Reuse `stopPlaceLine`,
`orderedStops` from `lib/itinerary/trip-intent.ts` and `searchAddresses` / saved places from `lib/places/`.

---

## Part C — Slot order follows the sentence (this is the new behaviour)

Today `task_compose` always walks what → who → when. It must instead follow the person.

### C1. Record the order

`IuiPayload` gains `slotOrder: SlotKey[]` — the slots in the order they were **filled by speech**, and
`focusSlot: SlotKey | null` — the first empty slot.

`parseCompoundHouseholdIntent` and `matchSpokenTokens` already know which slot each token filled;
they now also record the character offset of the match and sort the filled slots by it. `slotSource`
(`'speech' | 'touch' | 'model'`) stays as it is and keeps its meaning.

### C2. Render in that order

`task-compose-steps.tsx` renders its slot blocks in `slotOrder` first, then the remaining slots in the
scene's default order. A slot filled by speech or touch renders **filled** (domain tint, no question, no
picker) and is never re-asked. Exactly one slot is in focus: dashed border, its chips ready. Later slots
render dimmed with no chips.

Concretely, for "add a cleaning task for the dishes tomorrow": what and when are filled, **who** is in
focus and the faces are shown. For "Mia should do the dishes": who and what are filled, **when** is in
focus and Today / Tomorrow are shown — the face picker never opens.

### C3. A model guess can never overwrite a spoken slot

`canMergeBeat` already protects speech and touch slots. Extend it: a `'model'` patch is dropped for any
slot present in `slotOrder`, and logged as `iui.model_overwrite_blocked`.

### C4. Tests

`lib/poppins/slot-order.test.ts`: the three sentences in the canvas's "Slot order" board each produce the
expected `slotOrder` and `focusSlot`; a model patch for a spoken slot is dropped; a touch on a filled slot
still edits it.

---

## Part D — Teaching mode ("show me how", and walk me there)

Teaching is a first-class answer, not a chat reply. **It never costs an action** — record it as
`ActEvent` with `kind: 'coach'` and weight 0, and never call the chat model when the question matches a
known how-to.

### D1. The how-to index

New `lib/poppins/how-to.ts`: a typed list of the app's capabilities, each with
`{ id, question patterns, title, steps: [{ text, route, targetId? }], canDoItForYou: boolean }`.
Start with the twenty things people ask most: proof on a chore, the family iPad, inviting an adult,
house rules, recess, allowance, minting a reward, approving a claim, homework, groceries vs clothing,
shopping mode, quiet hours, notifications, the meter and what an action is, Base vs Max, switching
profiles, deleting a task, recurring chores, itineraries, saved places.

Matching is local and fuzzy (reuse `lib/grocery/fuzzy-match.ts`). No match → then, and only then, the
model answers.

### D2. The coach card

New scene `coach_steps` + `iui-coach-card.tsx`: domain-cyan kicker, a one-line answer, the numbered steps,
and two buttons — **Walk me through it** and **Just do it** (only when `canDoItForYou`, and it then runs
the normal act path with its usual hold).

### D3. Walking them there

Reuse the tour engine rather than building a second spotlight: `startAdHocTour(steps)` in
`components/orbit/tour/tour-provider.tsx` builds a tour from a how-to's steps, with the same
`FullWindowOverlay`, the same placement maths and the same always-visible exit (WO9.3).

Differences from the first-run tour, all required:
- the card says "Step 2 of 3" and carries **Do it for me** alongside **Next**;
- the step advances by itself when the person does the thing (the existing `advance.kind: 'action'`);
- "Stop the tour" ends it and returns to the Poppins tab where they asked;
- speech keeps working during it: "do it for me" advances, "stop" exits.

### D4. Tests

`lib/poppins/how-to.test.ts`: twenty questions map to the right entry; an unmatched question falls through
to the model; a coach turn records 0 actions.

---

## Part E — Motion and the perf budget

- Springs from `constants/motion-tokens.ts`: `snappy` for taps and chips, `smooth` for rows appearing and
  the card growing, `settle` for the mark and the ring. Opacity and colour use `withTiming` at 150 / 300 /
  600 with `Easing.out(Easing.cubic)`.
- Nothing slides sideways, nothing bounces, nothing scales more than 1.045 (the existing hold breath).
- Reduce Motion: every move becomes a cross-fade, every duration stays.
- One haptic per card: `impactAsync(Light)` on show, `notificationAsync(Success)` on settle. Not per row.
- Budget, measured on device and reported: words end → card **≤150 ms**; card → three rows saved
  **≤1.5 s**; undo tap → gone **≤600 ms**; coach card → spotlight **≤400 ms**.

---

## Part F — The four trouble states

One component each, all inside the same card shell:

1. **A slot is missing** — the question plus three chips. Never an invented value (the "Something" bug).
2. **Nothing heard** — the honest reason from WO10 §A2, plus one retry button.
3. **A row failed** — the failed row stays in place, red, with Retry and Leave it; the committed rows keep
   their check marks.
4. **The model is down, the acts are not** — the act's own confirmation, plus one line saying the talking
   part is offline. Never a failure sentence on a turn where the stage shows a success.

---

## Part G — Accessibility, non-negotiable

- Every control is a real `Pressable` with `accessibilityRole`, a label, and a 44 px target — including a
  row's × and the coach card's buttons.
- The card is `accessibilityViewIsModal` while a hold is armed, and VoiceOver focus moves to it on show.
- Text contrast ≥ 4.5:1: the muted greys on the stage are `#9DB4D2` on dark and `#46617F` on light. The
  older `textSubtle` (#4B6080) is for decoration only, never for words that carry meaning.
- Dynamic Type: the card scrolls its body rather than clipping its footer (the WO9.3 fix), and the row
  title may wrap to two lines.

---

## Part H — Device QA

Record each, Base and Max:

1. "add jam" → one card, one row, one hold, "Added jam to Groceries."
2. "add milk, eggs and bread" → one card, three rows, one hold.
3. "add a cleaning task for the dishes tomorrow" → **who** in focus, what and when already filled.
4. "Mia should do the dishes" → **when** in focus, no face picker.
5. "tomorrow someone needs to do the dishes" → **who** in focus, last.
6. "dentist for Noah next Thursday at half four" → event card with the clash line.
7. The six-stop trip sentence → trip card, stops in order, one unresolved address that doesn't block.
8. "how do I make a chore need a photo?" → coach card, 0 actions used; then Walk me through it → spotlight
   on the real Proof row; then Do it for me → it happens.
9. Every screen above in light mode.
10. Every screen above at the largest Dynamic Type.

## Part I — Flag back

- Which canvas boards you could not build as drawn, and why.
- The measured numbers from Part E.
- Any place where the design and this document disagreed.
- What you would delete next: the cleanup pass comes after this, so keep a list of what this work orphans
  (`iui-stepper`, `iui-hold-ring`, the old compose steps, anything else).

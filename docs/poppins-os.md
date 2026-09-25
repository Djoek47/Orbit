# Poppins OS — full rework

**Status:** implemented on `cursor/choremaxx-make-v15`. Device proof for the OS cut was IPA **46**. The IUI tap hangup fix is TestFlight **1.3.0 (49)** (`d7bc562`).

This replaces the “patch the overlay” loop. Visual restyle is out of scope. How Poppins thinks, what is on screen, and whether a task actually exists are in scope.

Related history: [`iui-method-note.md`](./iui-method-note.md), [`iui-ux-architecture.md`](./iui-ux-architecture.md), [`household-intelligence.md`](./household-intelligence.md), [`poppins-rework.md`](./poppins-rework.md). Where those conflict with this file, **this file wins**.

---

## Why the screenshots still look like nothing landed

TestFlight **1.3.0 (45)** is an older IPA. Even on this branch, the product is still three apps sharing one phone:

1. **The IUI stage** (category grid, faces, HOLD, “A draft is ready…”).
2. **Voice chrome** (orb glow, Speak/Done, keyboard, meter, “Type instead”).
3. **Inbox / Activity** (Notifications sheet with a **Poppins Activity** tab, hourglass, “Open Poppins”).

They stack. That is the glitch.

### Smoking gun (still in code)

`components/orbit/global-header-chips.tsx`:

```ts
useEffect(() => {
  if (drive.live) setInboxOpen(true);
}, [drive.live]);
```

When an act goes live, the **Notifications + Poppins Activity** sheet opens itself on top of the stage. That is the first screenshot: briefing card over the 14-category grid, with “Open Poppins” while already inside Poppins.

The hourglass on the Poppins tab still opens `PoppinsActivitySheet` (`variant="activity"`). The bell still opens the same sheet (`variant="inbox"`) with two tabs. Docs said Activity would never auto-open. The bell did the opposite.

### Draft is not create

The model tool is still named `create_task_draft`. Execution **does not write a task**. It returns `ui_actions` and a note: “Staged Assign on the IUI stage.” Copy says “I’ll draft a task…”. HOLD is supposed to commit later, but the product language, the extra confirm modal, and `navigate_coach` / `/create-task` leftovers still produce a **preview**, not a household task. That is why screens pile up: the system never finishes, so it keeps offering another menu.

### What ~TestFlight 38 got right

Build **38/39** (v13 AIUIC) felt like one overlay doing the act. Speak started. Kitchen became Kitchen. It was not perfect (no memory, greetings, barge-in gaps) — but it was **one thing**. Later cuts split that overlay into tab stage + hourglass log + inbox sheet + in-place Ask + draft tool. Each piece was “correct” in isolation. Together they are three menus.

We are not restoring that IPA pixel-for-pixel. We take its **one-viewport law** and rebuild the rest to today’s standard (tap wins, memory, create-for-real, Speak that starts).

---

## Primary goal

The user wants the house to **do something**. Usually: assign a chore, add milk, mark done, put a thing on the calendar.

Poppins is the co-manager for that. Not a chatbot. Not a second Notifications app. Not a draft studio.

**If they say “dishes for Drako tomorrow,” a task exists when they are quiet or they tap Done.** They should not see a briefing, a category grid, and a draft form at the same time.

---

## Product hierarchy (what deserves a surface)

### First-class (always there)

| Surface | Job |
|---|---|
| **Home / Tasks / Plan / Rewards** | The household, as today. Unchanged IA. |
| **Poppins tab** | The only live IUI. Speak + one scene. |
| **Bell** | Apple Notification Center: a **list of household alerts**. Not a Poppins product. |
| **Settings** | Account, meter, voice, house. Never an IUI HOLD. |

### Contextual (appear only when needed)

| Surface | When |
|---|---|
| Keyboard | Mic denied, network dead, or user taps Type. |
| Human editor (`/assign-task`, `/create-event`) | They asked to drive the full form themselves. |
| Permission sheet | First Speak, explained, at the moment of Speak. |

### Removed from the product

- **Poppins Activity tab** inside Notifications.
- **Hourglass** on the Poppins tab.
- **Auto-opening** any sheet when IUI goes live.
- **“Open Poppins”** on a briefing while the Poppins tab is already showing.
- **In-place Ask sheet** as a second stage (House Rules long-press can stay as a **shortcut to the Poppins tab**, not a clone stage).
- **`create_task_draft` as a product concept.** Replace with assign/create that writes.
- **Extra Confirm/Cancel modal** on top of HOLD for ordinary chores.
- **14-category grid** once category is known (or once they named the chore).
- **Transcript as the main UI.** Captions only when the stage is empty.

---

## One-viewport law

At any moment the user sees **exactly one** of:

1. **Idle Poppins** — orb at rest, Speak, quiet meter. No grid. No briefing. No caption novel.
2. **Live scene** — one beat: faces *or* one category *or* a named chore *or* a day *or* HOLD preview. Orb is status behind the scene, not a second window.
3. **Notifications list** — full-screen / sheet that **covers** Poppins. Live IUI pauses and hides. Close returns to the frozen scene (or idle).
4. **Settings / other modal** — same: pause and cover, never composite.

If two of those are visible, the build is wrong. Do not “dim” the grid under a sheet. Hide it.

---

## Information architecture

```
Choremaxx
├── Home, Tasks, Plan, Rewards     ← household record
├── Poppins                        ← live co-manager (IUI)
│     Speak / Done                 ← one thumb control
│     Stage                        ← one scene
│     Type                         ← failure / accessibility door
└── Bell                           ← alerts (not Activity)
      Today / earlier
      Daily briefing = one card in the list, not a second app
```

Poppins Activity as a **named place** goes away. If we need a log, it is a quiet section **inside Notifications**: “From Poppins” — same list, same swipe, same empty state. No second tab. No hourglass brand.

---

## Interaction model (two modes, one mind)

Talking and touching are the same act. Faster input wins.

| Input | Live act | Idle |
|---|---|---|
| Speak | Stop listening; keep the scene if an act is open | Start. Warm mic **now**. No greet. |
| Tap a face / chip / day | Write that beat **now**. Cancel speech. Never re-offer it. | Same |
| Silence (~0.85s, longer for kids) | Commit the previewed write | Keep listening |
| “No” / X | Veto the act | n/a |
| “Wait” | Freeze | n/a |
| Type line | Same as speech for that turn | Side door |
| Bell | Pause + **cover** (viewport 3) | Open list |
| Background / hangup | Freeze open HOLD; remember 4h | Tear down WebRTC |

HOLD is the confirmation for reversible household writes. Do not also show a system Confirm sheet.

Ask for a real confirm only for: delete account, spend / IAP, privacy-sensitive memory, irreversible destroy.

---

## Core journey: assign a task (must create)

1. **Entry:** Poppins tab → Speak (or Type).
2. **Intent:** “Set up a task” / “dishes for Drako tomorrow” / tap Kitchen.
3. **Primary action:** fill **only unknown beats**. Known kitchen + tomorrow never shows 14 tiles.
4. **System:** stage a **preview** of the real `createTask` payload (title, assignee, due, category).
5. **Commit:** silence, or tap the HOLD control, or tap the preview. **Then `createTask` / library assign runs.** Tasks tab shows it. Home shows it.
6. **Success:** one settle mark (“Assigned to Drako”). Then rest. Do not open Create Task. Do not open Activity. Do not open Notifications.
7. **Error:** preview stays. Calm line: “Couldn’t save. Tap to try again.” No “Type instead” unless the mic actually failed.
8. **Interrupted:** hangup freezes the preview. Next Speak continues. Does not greet. Does not reopen Inbox.

Speech after commit: “It’s assigned to Drako for tomorrow.” Never “A draft is ready.”

Same pattern for grocery add, complete, calendar event, itinerary stop.

---

## Speak (reliability is product)

“Poppins could not start. Type instead.” is an **error state**, not a mode.

- Warm mic on Speak tap only. Never hold a dead mic after hangup.
- Tear down WebRTC on sign-out and before remount (already started for the crash fix).
- If start fails: keep Speak visible, show one recoverable line, offer Type. Next Speak retries. Do not leave the tab in a typed-chat identity.
- Meter (`$x of $4`) is caption under Speak, not a third chrome system.

---

## Notifications (Apple Notification Center, not Poppins 2)

- Bell badge = unread household alerts.
- One list. Briefing is a card **in** the list, not a launcher.
- Tapping a task alert opens **that task**. Tapping a briefing body can deep-link Home. It does **not** open a second Poppins.
- Opening Bell during a live act: pause, hide stage, show list. Close: restore frozen stage.
- **Never** `setInboxOpen(true)` because `drive.live`.

---

## States (stage)

| State | What you see | What happens if they do nothing |
|---|---|---|
| First use | Orb + Speak. One optional presence line, never a bio. | Wait. |
| Returning (4h) | Same scene if frozen; else idle. No greet. | Wait. |
| Listening | Subtle orb. No grid. | Keep listening. |
| Unknown beat | Only that picker. | Wait, or they tap. |
| HOLD | Preview of the **real** write. | Commit. |
| Success | Settle mark, then idle. | Rest. |
| Mic / network fail | Speak still there + Type. One line. | They tap Speak or Type. |
| Offline | Type if possible; queue safe writes; don’t pretend voice works. | They retry. |
| Meter paused | Speak disabled with the existing pause copy. Type still works if we allow text. | They wait until the trip resets. |

Empty Poppins is **not** a category grid and **not** a briefing.

---

## What the system remembers

Unchanged three layers ([`household-intelligence.md`](./household-intelligence.md)): Now, Session (4h), House. Memory seeds defaults. It does not spawn extra screens.

---

## Accessibility

- Speak and Type are equal doors. VoiceOver: “Speak”, “Type to Poppins”, scene labels on faces/chips.
- HOLD remaining time announced once, not every frame.
- Reduce Motion: skip orb bloom; keep one scene crossfade.
- Hit targets ≥ 44pt. Category labels never clip (“Shared spaces”, not “Shared Sp…”).
- Dynamic Type on captions and list rows; scene grids can scale down one step rather than overlap Speak.

---

## Permissions

Mic: ask on first Speak, with one line of why. Denied → Type path, app otherwise usable. Location stays on Places / shopping, not on Poppins open.

---

## Automation (use intelligence, don’t add AI)

- Skip known beats.
- Restore frozen HOLD.
- Don’t greet.
- Don’t auto-open Inbox.
- Don’t auto-navigate to Create Task.
- Do auto-write on HOLD for chores.

---

## Implementation map (landed)

Shipped on `cursor/choremaxx-make-v15`. Do not restyle the orb. Do not re-port Figma.

### Slice A — stop the stacking

- Deleted `drive.live → setInboxOpen(true)`.
- Removed hourglass from `app/(tabs)/poppins.tsx`.
- Bell sheet: **one list**, no Activity tab.
- Briefing: “View Home”, and no launcher when already on `/poppins`.
- Ambient orb bloom hides while a live scene is up.

### Slice B — create, don’t draft

- `assign_task` is a compat alias; HOLD commit calls `createTask` / `buildLibraryAssignInput` with the chosen due date.
- System prompt + majordomo: “assigned”, never “draft”.
- Ordinary chore confirms auto-resolve; Confirm modal is for risky tools only.

### Slice C — one scene

- Live stage occupies the tab; idle orb bloom stays behind idle only.
- Named kitchen/chore/day never mounts the 14-tile category grid (`nextComposeStep` skips known beats).
- Category labels wrap; “Shared Spaces” compact label is “Shared”.

### Slice D — Speak

- Error copy + retry. Type is a door. Only a denied mic forces the keyboard open.

---

## Apple-level tests (fail the build)

- Can this be simpler? If a briefing and a grid and Speak are up, **no**.
- Does the user need this choice? They do not need Activity vs Notifications.
- Why does this button exist? Hourglass has no job once Activity is gone.
- What if they do nothing on HOLD? A task is created.
- What if they do nothing on idle? Nothing. That is correct.
- What happens tomorrow? Frozen act or quiet listen. No greet.
- What if Speak fails? One line, Type, retry. App still works.
- What if there is no internet? Don’t start a fake voice session.

---

## Out of scope

Welcome / sign-in animations, Figma Make re-port, new tab bar, Nova as a second brain, visual “iOS 27 liquid glass” restyle of Home/Tasks.

# Realtime Interactive Menus (Poppins-driven UI)

**Codename:** Realtime Interactive Menus  
**Target:** Post–v11 TestFlight smoke (tomorrow)  
**Branch:** `cursor/choremaxx-make-v11` (then v12 tip if needed)  
**Depends on:** Poppins Divine Voice (#32) — live session + `ui_actions` / tool plane already shipping

---

## Problem

Today Poppins can **execute tools** (create task, assign member, advance itinerary, navigate) but the household often only sees:

- A spoken summary in the Poppins tab, and/or
- A static Activity feed row

The **app surfaces themselves stay silent** — no animated menus, no visible assignment picker choreography, no Plan stop advancing on screen while Poppins talks. That breaks the “co-manager is working *with* you” promise.

## Goal

When Poppins runs a tool during a **live voice or text session**, the relevant screen **animates in real time** — menus open, chips highlight, itinerary stops advance, location cards pulse — **while** Poppins speaks the summary. The user watches the app work, not just hears it.

---

## Scope v1 (tomorrow)

### 1. Tasks & assignment

| Trigger (tool / ui_action) | Visible UI behavior |
|----------------------------|---------------------|
| `create_task_draft` / `create_task` | Navigate to Create Task with prefill; fields **type in** one-by-one (title → assignee → due) with short stagger |
| `update_task` / assignee change | Tasks tab scrolls to row; assignee chip **pulses**; optional bottom sheet “Assign to …” opens with selection animating |
| `complete_task` | Row checks off with success micro-animation + XP flash |
| `list_tasks` / `list_overdue_tasks` (when user asked) | Filter chips animate; matching rows **highlight** sequentially as Poppins reads them |
| `navigate_to` → `/(tabs)/tasks` | Tab switch + brief “Poppins opened Tasks” toast |

**Assignment menu (hero):** reusable `PoppinsAssignmentSheet` — member avatars in a horizontal picker; Poppins can drive `highlightMemberId` + `confirmSelection` via session bus.

### 2. Plan & location itineraries

| Trigger | Visible UI behavior |
|---------|---------------------|
| `create_itinerary` / `propose_plan` | Plan tab opens; draft card **slides up** with title/detail filling in |
| `advance_itinerary_stop` | Active itinerary: current stop **collapses**, next stop **expands** with map/place pin bounce |
| `list_itineraries` | Itinerary cards stagger-in; active trip gets accent ring |
| `read_calendar` / `get_calendar_agenda` | Calendar agenda rows highlight in sync with spoken event names |
| `navigate_to` → `/(tabs)/calendar` | Tab switch + scroll to next 48h block |

**Location itinerary menu:** `PoppinsItineraryStage` overlay on Plan — shows stop list, current pin, “Poppins is updating your route…” rail when tools run.

### 3. Poppins presence while working

- **Orb state:** `thinking` → `speaking` while menus animate; optional **needs_attention** when confirm sheet is up (already in Divine Voice).
- **Mini rail:** thin bottom banner on driven screens: “Poppins · assigning Dishes to Alex…” (dismisses when animation completes).
- **Session bus:** `PoppinsUiOrchestrator` consumes `ui_actions[]` from voice-tool / client executor and emits `{ screen, animation, payload }` events consumed by Tasks / Plan screens.

---

## Architecture (minimal diff)

```
PoppinsVoiceSession / executePoppinsToolCall
        │ ui_actions[]
        ▼
PoppinsUiOrchestrator (new: lib/poppins/ui-orchestrator.ts)
        │ subscribe per tab
        ▼
TasksScreen / CalendarScreen / CreateTaskScreen …
        │ Reanimated stagger + highlight IDs
        ▼
User sees menus animate while audio plays
```

**Rules:**

1. **Same live session** — interactive menus only when `PoppinsVoiceSession.isConnected` or text twin just returned `ui_actions` (composer path).
2. **No silent mutations** — consequential writes still go through existing confirm sheet; animation **previews** the pending change until approved.
3. **Interruptible** — user tap cancels orchestration; Poppins idle hangup clears pending animations.
4. **Expo Go degrade** — text path + Activity feed still work; full choreography requires TestFlight (same as WebRTC).

---

## Tool plane additions (optional v1.1)

| Tool | Purpose |
|------|---------|
| `ui_highlight` | `{ route, elementId, durationMs }` — generic highlight for menus not yet wired |
| `ui_open_menu` | `{ menu: 'assign_task' \| 'itinerary_stop' \| 'grocery_aisle', context }` |

Keep using existing tools first; add these only if orchestrator needs explicit menu open signals.

---

## Acceptance (device)

1. Connect Poppins → “Create a dishwasher task for Alex due tomorrow” → **Create Task opens**, fields animate in, Poppins speaks summary **while** UI fills.
2. “Show overdue tasks” → Tasks tab highlights overdue rows **in order** as Poppins lists them.
3. “Advance the trip stop” (active itinerary) → Plan screen **animates** to next stop; spoken confirmation.
4. Risky assign/reassign → menu animates to **preview**; confirm sheet before commit.
5. End session / navigate away → animations cancel cleanly; no stuck overlays.

---

## Phase checklist (C1)

| Step | Task |
|------|------|
| C1.1 | `PoppinsUiOrchestrator` + store hook `usePoppinsUiDrive()` |
| C1.2 | Tasks: highlight rows, assignment sheet, create-task prefill animation |
| C1.3 | Plan: itinerary stop advance + calendar agenda highlight |
| C1.4 | Mini rail component + wire orb states on driven tabs |
| C1.5 | Voice + text paths both emit `ui_actions` through orchestrator |
| C1.6 | Docs + TestFlight smoke rows in expo-go matrix |

**Out of scope tomorrow:** new tabs, Figma Make sync, roommate mode, paying allowance via AI.

---

## Related

- [choremaxx-make-v11.md](./choremaxx-make-v11.md) — tonight TestFlight
- [weekend-ship-automation.md](./weekend-ship-automation.md) — Phase C slot
- [adr-poppins-post-tool-response-create.md](./adr-poppins-post-tool-response-create.md) — spoken summary after tools
- `lib/ai/execute-poppins-tool.ts` — existing `ui_actions` shapes

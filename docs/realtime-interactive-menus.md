# Realtime Interactive Menus (Poppins-driven UI)

**Codename:** IUI (Interactive AI-controlled window) — Phase C1  
**Branch:** `cursor/realtime-interactive-menus-5f8f` from Make v11  
**Depends on:** Poppins Divine Voice — live session + `ui_actions` / tool plane

## Genie loop (speed)

The Activity window is the AI’s hands. **Do not wait for Luna** to paint. User speech hits `hearAndDrive` immediately: local intent starts the beat, spoken text appears as-is, tools merge into the same beat instead of restarting SHOW.

| Clock | Duration |
|-------|----------|
| SHOW (lattice / road only) | 160ms — skipped when the utterance already named the beat |
| Speech quiet before HOLD | 70ms |
| HOLD (assent) | 850ms (1300ms kids) |
| Result linger | 420ms |

Ghost fields snap. The stage does not remount on phase. Hourglass history never covers a live act. Voice failure drops Done/PROCESSING and offers type-instead.

Human screens open only when the user asks for help, or for **Settings** (navigate-only). See [iui-method-note.md](./iui-method-note.md) for the method stub.

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

1. Connect Poppins → no `response.modalities` error.
2. “Add a dishwasher task for Alex” plays in the **Activity window** and **commits on silence** (HOLD). Full editor only if asked.
3. “Add a store to the itinerary, then a dentist appointment” **chains** itinerary_stage → calendar_zoom in the same window, no tap.
4. “Not Alex, Maya” mid-HOLD steers without restarting.
5. Settings requests Coach-navigate only (no HOLD-commit).
6. Voice and Luna (Expo Go text twin) both hit the orchestrator.

---

## Phase checklist (C1)

| Step | Task |
|------|------|
| C1.0 | Strip `response.modalities`; Majordomo theme-tinted blur |
| C1.1 | `PoppinsUiOrchestrator` + closed `ui-scenes` + `usePoppinsUiDrive()` |
| C1.2 | Activity sheet morphs into `PoppinsStage` (one window, listening throughout) |
| C1.3 | Scenes: thinking, task_compose, calendar_zoom, itinerary_stage, member_pick, navigate_coach |
| C1.4 | grocery_add, reward_mint, list_peek, confirm; Settings navigate-only |
| C1.5 | Voice + Luna `ui_actions` through orchestrator; `present_ui_scene` closed enum |
| C1.6 | HOLD silence = commit; barge-in revise; `docs/iui-method-note.md` |

**Out of scope tomorrow:** new tabs, Figma Make sync, roommate mode, paying allowance via AI.

---

## Related

- [choremaxx-make-v12.md](./choremaxx-make-v12.md) — v12 aggregate + v13 ship
- [weekend-ship-automation.md](./weekend-ship-automation.md) — Phase C slot
- [adr-poppins-post-tool-response-create.md](./adr-poppins-post-tool-response-create.md) — spoken summary after tools
- `lib/ai/execute-poppins-tool.ts` — existing `ui_actions` shapes

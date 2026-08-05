# ChoreMaxx Make v9

**Branch:** `cursor/choremaxx-make-v9-5f8f`  
**Base:** `cursor/choremaxx-make-v8-5f8f` (includes v7 tip + Revision C landings + email library)  
**Authoritative specs:**

| Document | Path |
|---|---|
| Revision B (v2) | `docs/logic/choremaxx-v2-cursor-spec.md` |
| Revision C | `docs/logic/choremaxx-revision-c-spec.md` |
| Revision D | `docs/logic/choremaxx-revision-d-spec.md` |
| Task library | `data/choremaxx-task-library.json` |
| Grocery categories | `data/choremaxx-grocery-categories.json` |

## Decisions locked for v9

1. Branch from v8 so nothing from v7/v8 is lost; implement D on top.
2. `FIRST_RESCUE_IS_FREE = true`, but only after the member **presses** the rescue confirmation prompt (`confirmedViaPrompt: true`).
3. Constants live at Expo paths `constants/scoring.ts` and `constants/vocabulary.ts` (not `src/constants/` — Claude-authored path adapted to this repo).
4. Execute Revision D Phases 1→5 with STOP GATES; close remaining Revision C gaps; website/Resend/MVP-close wait until D §10 is done.

## Phase status

| Phase | Status |
|---|---|
| 1 Scoring engine | STOP GATE 1 — see test output |
| 2 Crowns | pending |
| 3 Recess | pending |
| 4 House Rules | pending |
| 5 Notifications + polish | pending |

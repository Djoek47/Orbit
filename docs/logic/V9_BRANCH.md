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
| 1 Scoring engine | DONE — 28/28 |
| 2 Crowns | DONE — 10/10 + UI (CrownLeaderboard, Champion's Record, medal colours) |
| 3 Recess | DONE — 11/11 + Settings → Recess + Home banners |
| 4 House Rules | DONE — 8/8 + Settings → House Rules (adult/kid) |
| 5 Notifications + polish | DONE — 6/6 engine + PersistentScrollView + WheelPickerChrome |

## Test scripts

```bash
npm run test:revision-d-phase1
npm run test:revision-d-phase2
npm run test:revision-d-phase3
npm run test:revision-d-phase4
npm run test:revision-d-phase5
```

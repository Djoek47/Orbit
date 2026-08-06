# Next session — weekend App Store ship

**Playbook:** [`docs/weekend-ship-automation.md`](./weekend-ship-automation.md)  
**Branch:** `cursor/choremaxx-make-v10-5f8f` → [PR #29](https://github.com/Djoek47/Orbit/pull/29)

## Tip baseline (when you wake up)

v10 includes: Rev C/D/E, House Rules 4-views, Canada grocery catalog + emojis, **Smart Shopping** (HTML bible × ChoreMaxx tokens — in-aisle check + undo, amber-orbit glass, Start shopping). Weekend **A1–B7 still unexecuted**.

## Start here

1. Agent / Automation: *Execute Phase A then Phase B from docs/weekend-ship-automation.md*
2. Order locked: **A (foundation) → B (craft)**. No App Review until B6 green.
3. TestFlight gets OTA on channel `testflight`. Native iOS rebuild only if EAS quota allows (`npm run build:ios:testflight`).

## Already on tip (do not redo)

- House Rules 01–04 × Adult/Kid  
- Canada grocery search/browse/favorites + per-item emoji  
- Smart Shopping redesign (orbit colors / Bricolage / design-system glass)  
- Night-spec Rev C/D/E closeout  

**Live site:** https://choremaxx.vercel.app/

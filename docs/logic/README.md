# Choremaxx Logic specs

Source-of-truth implementation briefs. **Revision D wins** where it conflicts with older streak/XP rules.

- [Revision B — v2 cursor spec](./choremaxx-v2-cursor-spec.md)
- [Revision C](./choremaxx-revision-c-spec.md)
- [Revision D — Scoring · Crowns · Recess · House Rules](./choremaxx-revision-d-spec.md)
- [Reward mode (Meritocracy vs Equity)](./choremaxx-reward-mode-cursor-spec.md)
- [Streak engine (pre-D; superseded by Revision D §1.4–1.5)](./choremaxx-streak-engine-cursor-spec.md)
- [Trophies Part 2](./choremaxx-trophies-part2-cursor-spec.md)
- [V9 branch notes](./V9_BRANCH.md)

Data files:

- `data/choremaxx-task-library.json` / `.ts`
- `data/choremaxx-grocery-categories.json`

## Scoring constants (Revision D)

- `constants/scoring.ts` — **only** place Late Credit / rescue / bundle numbers live
- `constants/vocabulary.ts` — Late Credit, Expired, Streak Rescue, Recess, crowns, …

## Tests

- `npm run test:revision-d-phase1` — STOP GATE 1 (T1.1–T1.28)
- `npm run test:logic` — broader suite

## Trophies status

**Part 1 definitions are pending.** The Part 2 engine at `lib/trophies/` is wired with an **example seed only**. Do not invent the full 100 trophy names/thresholds until Part 1 arrives.

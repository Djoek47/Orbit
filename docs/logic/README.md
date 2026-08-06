# Choremaxx Logic specs

**Entry point:** [MASTER BRIEF](./choremaxx-MASTER-BRIEF.md). Read it first. **§3 of the Master Brief wins** every conflict with older docs.

| # | Document | Status |
|---|---|---|
| — | [MASTER BRIEF](./choremaxx-MASTER-BRIEF.md) | Entry point · Rule Sheet |
| 1 | [Revision B — v2 cursor spec](./choremaxx-v2-cursor-spec.md) | In force, heavily superseded — see Master Brief §4 |
| 2 | [Revision C](./choremaxx-revision-c-spec.md) | In force |
| 3 | [Revision D](./choremaxx-revision-d-spec.md) | In force (scoring · crowns · recess · house rules) |
| 4 | [Revision E](./choremaxx-revision-e-spec.md) | In force (slogans · notifications · history · vocabulary) |
| 5 | [House Rules renderer](./CURSOR-SPEC-house-rules.md) | Part 2 — JSON-driven Direction 01 |

Supporting:

- [Reward mode (Meritocracy vs Equity)](./choremaxx-reward-mode-cursor-spec.md)
- [Streak engine (pre-D; superseded by Revision D §1.4–1.5)](./choremaxx-streak-engine-cursor-spec.md)
- [Trophies Part 2](./choremaxx-trophies-part2-cursor-spec.md)
- [V9 branch notes](./V9_BRANCH.md)

Data files:

- `data/choremaxx-task-library.json` / `.ts`
- `data/choremaxx-grocery-categories.json`
- `data/house-rules.json` — sole source of House Rules copy

## Scoring constants (Revision D / E)

- `constants/scoring.ts` — Late Credit / rescue / bundle numbers (+ monthly Rescue token)
- `constants/vocabulary.ts` — Late Credit, Expired, Streak Rescue, Recess, crowns, intro slogans
- `constants/notifications.ts` — closed notification registry (Revision E)

## Tests

- `npm run test:revision-d-phase1` — STOP GATE 1 (T1.1–T1.28)
- `npm run test:logic` — broader suite
- `npm run test:house-rules` — JSON decode / visibility / parity

## Trophies status

**Part 1 definitions are pending.** The Part 2 engine at `lib/trophies/` is wired with an **example seed only**. Do not invent the full 100 trophy names/thresholds until Part 1 arrives.

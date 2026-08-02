# Choremaxx Logic specs

Source-of-truth implementation briefs for rewards, streaks, and trophies.

- [Reward mode (Meritocracy vs Equity)](./choremaxx-reward-mode-cursor-spec.md)
- [Streak engine](./choremaxx-streak-engine-cursor-spec.md)
- [Trophies Part 2](./choremaxx-trophies-part2-cursor-spec.md)

## Trophies status

**Part 1 definitions are pending.** The Part 2 engine at `lib/trophies/` is wired with an **example seed only** (`lib/trophies/seed-examples.ts`, ≤8 stubs covering each evaluator type). Do not invent the full 100 trophy names/thresholds until `choremaxx-100-trophies-part1.md` is available.

Companion files still required when implementing full seeds from external CSV/Part 1:

- `choremaxx_tasks.csv` (authoritative XP SoT if re-importing)
- `choremaxx-100-trophies-part1.md` (trophy names/tiers/conditions)

The in-repo task library at `data/choremaxx-task-library.ts` (T001–T150) is the current seeded reference for Expo mock mode.

Run engine checks: `npm run test:trophies`.

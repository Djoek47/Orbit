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

The in-repo task library at `data/choremaxx-task-library.ts` (T001–T150) is the current seeded reference for Expo mock mode. Validate with `npm run test:task-library`.

Run engine checks:

- `npm run test:logic` (all of the below)
- `npm run test:reward-mode`
- `npm run test:streak-engine`
- `npm run test:trophies`
- `npm run test:today`
- `npm run test:completion-xp`
- `npm run test:daily-streak`
- `npm run test:claim-reward`
- `npm run test:task-library`

## Mock continuity (Expo Go)

- Created/joined households persist via `@orbit/mock_active_household.v1` (`lib/household/mock-active-household.ts`).
- Reward mode / hygiene / member capabilities hydrate from AsyncStorage (`lib/household/reward-settings-prefs.ts`).
- Allowance ledger is household-scoped AsyncStorage until a Supabase table ships.
- **Kid profile invite codes** already persist in AsyncStorage (`lib/household/child-invites.ts` key `choremaxx.childInvites.v1`) — redeem on the same device still works after app restart.

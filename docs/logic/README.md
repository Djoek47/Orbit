# Choremaxx Logic specs

**Entry point:** [MASTER BRIEF](./choremaxx-MASTER-BRIEF.md). Read it first. **§3 of the Master Brief wins** every conflict with older docs.

| # | Document | Status |
|---|---|---|
| — | [MASTER BRIEF](./choremaxx-MASTER-BRIEF.md) | Entry point · Rule Sheet · Q1=B · Rev F |
| 1 | [Revision B — v2 cursor spec](./choremaxx-v2-cursor-spec.md) | In force, heavily superseded — see Master Brief §4 |
| 2 | [Revision C](./choremaxx-revision-c-spec.md) | In force |
| 3 | [Revision D](./choremaxx-revision-d-spec.md) | In force (scoring · crowns · recess · house rules) |
| 4 | [Revision E](./choremaxx-revision-e-spec.md) | In force (slogans · notifications · history · vocabulary) |
| 5 | [Revision F](./choremaxx-revision-f-spec.md) | In force (invites · Hold & Request · Expired tab · Assign rebuild) |
| 6 | [House Rules renderer](./CURSOR-SPEC-house-rules.md) | JSON-driven; F adds R30–R33 |

Supporting:

- [Reward mode (Meritocracy vs Equity)](./choremaxx-reward-mode-cursor-spec.md)
- [Streak engine (pre-D; superseded by Revision D §1.4–1.5)](./choremaxx-streak-engine-cursor-spec.md)
- [Trophies Part 2](./choremaxx-trophies-part2-cursor-spec.md)
- [V9 branch notes](./V9_BRANCH.md) · [V8](./V8_BRANCH.md)

Data files:

- `data/choremaxx-task-library.json` / `.ts` — seed; gains `shortName` (Rev F §10.3)
- `data/choremaxx-grocery-categories.json` — 16 aisles · 1120 lexicon (Rev C)
- `data/house-rules.json` — sole source of House Rules copy

## Scoring constants (Revision D / E / F)

- `constants/scoring.ts` — Late Credit / rescue / bundle (+ monthly Rescue token product override; Q2 free-first still flagged)
- `constants/vocabulary.ts` — Late Credit, Expired, Streak Rescue, Recess, crowns, intro slogans
- `constants/notifications.ts` — closed notification registry (Revision E); N26/N27 live for F Hold & Request

## Tests

- `npm run test:revision-d-phase1` — STOP GATE 1 (T1.1–T1.28)
- `npm run test:logic` — broader suite
- `npm run test:house-rules` — JSON decode / visibility / parity
- `npm run test:revision-f` — Rev F §1 uniqueness / occurrence gates (when present)

## Trophies status

**Part 1 definitions are pending.** The Part 2 engine at `lib/trophies/` is wired with an **example seed only**. Do not invent the full 100 trophy names/thresholds until Part 1 arrives.

## Product overrides already on v10 (do not blindly revert)

- Monthly Rescue token (`MONTHLY_RESCUE_TOKENS = 1`) instead of lifetime free-first — pending Master Brief Q2 confirmation
- Canada grocery catalog + Smart Shopping — additive on Rev C classifier; do not strip to C-only list
- House Rules 4-views (Chapters / Glance / Track / Ask Poppins)

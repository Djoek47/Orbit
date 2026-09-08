# Choremaxx Make v19

**Branch:** `cursor/make-v19` — **stay here until explicitly cut to v20**  
**Follows:** `cursor/make-v18` (TestFlight **1.3.0 (69)** build finished)  
**Baseline tip:** inherits all make-v18 work through ghost-inbox / rewards-edit / get-started-freq / deadline-picker.

## Cut checklist (audited)

| Check | Status |
|-------|--------|
| Code tree matches make-v18 tip (TF69 features) | Yes — only intentional diffs: `BUILD_INFO`, v19 doc, SQL checklist lines |
| Editable rewards (`updateReward`, `/create-reward?id=`) | Present |
| Get Started task frequency + migration `20260908090000_…` | Present |
| Daily deadline picker (explicit-height ScrollView) | Present |
| Ghost inbox (`markAllRead` household-scoped, Clear all, tombstones) | Present |
| Stop repeating footer removed (Repeats dropdown confirm remains) | Present |
| Canonical agent rules → `cursor/make-v19` | `AGENTS.md`, `single-shipping-branch.mdc`, `no-improvise-shipped-baseline.mdc` |
| Expo doctor cleanup | Deferred (below) |

## Carry-forward from v18

| Item | Status |
|------|--------|
| TestFlight **1.3.0 (69)** | EAS build **finished** (`7777ca77-…`, git `f23272c`). ASC submit `096874f0-bcb4-4530-9fa1-2c1b7bc2d77b` scheduled — install from TestFlight when Apple finishes processing |
| Two-phone QA matrix | Still open — checkboxes in `docs/sync-and-notifications-v18.md` / make-v18 doc |
| Staging SQL | Apply `20260908090000_member_planned_task_frequencies.sql` (+ `20260903120000_notifications_member_update.sql` if dismiss still fails) |
| Per-task “extend deadline” | Explored; not shipped — household Daily deadline picker only |
| Expo doctor cleanup | **Deferred** (see below) |

## Deferred: Expo doctor (do later on this branch)

Not blocking TF69. Clean up when convenient:

1. Invalid `expo.linking` in `app.json`
2. `eas-cli` in project dependencies (prefer global / `cli.version` in `eas.json`)
3. RN Directory warnings: `react-native-webrtc`, `torch-image-playground`
4. Patch bumps: `expo` / `expo-constants` / `expo-updates`

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| *(none yet on v19)* | | | |

Parent line (v18): **1.3.0 (69)** finished — see `docs/choremaxx-make-v18.md`.  
Logs: https://expo.dev/accounts/djoek47/projects/choremaxx/builds/7777ca77-4525-4cc0-977e-00197e2aeae5

## TestFlight env (`eas.json`)

Same as v18:

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

See full list in `docs/choremaxx-make-v18.md`. **v19-critical if not applied:**

1. `20260908090000_member_planned_task_frequencies.sql`
2. `20260903120000_notifications_member_update.sql`

## Verify in app

Settings build tip: `make-v19 · cut-from-v18 · tf69-baseline`

## Notes for agents

- Design source remains Figma Make `4J6d4LW335tDyEDpqq3VD1`.
- Product SoT: `docs/product-context.md`, `docs/ux-design-system.md`, `docs/technical-blueprint.md`.
- Sync/push reference still: `docs/sync-and-notifications-v18.md` until a v19 sync doc is warranted.
- Keep `EXPO_PUBLIC_DATA_MODE=mock` for Expo Go cloud work unless user asks for Supabase.
- Stay on **`cursor/make-v19`** only (see `.cursor/rules/single-shipping-branch.mdc`).

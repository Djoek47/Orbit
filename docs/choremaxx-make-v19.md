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
| TestFlight **1.3.0 (69)** | **Beta App Review refused** (2026-09-10) — Guideline 2.1(a) no demo access after mock removed. Fixed on v19 via Review Demo credentials (see below). Do **not** promote 69 external until a new build ships. |
| Two-phone QA matrix | Still open — checkboxes in `docs/sync-and-notifications-v18.md` / make-v18 doc |
| Staging SQL | Apply `20260908090000_member_planned_task_frequencies.sql` (+ `20260903120000_notifications_member_update.sql` if dismiss still fails) |
| Per-task “extend deadline” | Explored; not shipped — household Daily deadline picker only |
| Expo doctor cleanup | **Deferred** (see below) |

## Apple Review Demo (Guideline 2.1(a))

In-app Sign in (TestFlight) with:

- **User Name:** `review@choremaxx.app`
- **Password:** `ReviewDemo2026!`

Opens local Rivera household (full features). Put the same values in ASC → TestFlight → Test Information → Beta App Review Information → Sign-in required. Details: `docs/testflight-setup.md`.

## Poppins cost metering (v19)

- Rates: `constants/poppins-ai-rates.ts` (Luna **$0.20 / $1.20** per 1M — was wrongly 5/15).
- Monitor: rules-first edge gate; `POPPINS_MONITOR_MODEL` default **off**; max 2 rounds; 3 model calls/day when on.
- Ops check: `docs/poppins-monitor-ops.md`
- Spec: `docs/poppins-pricing-and-metering.md` (§1/§2/§8 landed; acts UI caption deferred)
- Migration: `20260916230000_ai_usage_events_metering.sql` — apply on staging before trusting spend logs

## Deferred: Expo doctor (do later on this branch)

Not blocking TF69. Clean up when convenient:

1. Invalid `expo.linking` in `app.json`
2. `eas-cli` in project dependencies (prefer global / `cli.version` in `eas.json`)
3. RN Directory warnings: `react-native-webrtc`, `torch-image-playground`
4. Patch bumps: `expo` / `expo-constants` / `expo-updates`

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (71)** | `836f608` | [65d178b8…](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/65d178b8-53b7-4fb9-8586-eccd9ed9393b) — Review Demo on Sign in | [auto-submit](https://expo.dev/accounts/djoek47/projects/choremaxx/submissions/0af7499c-335f-41c3-bad6-88cecf2a501e) (free-tier queue) |
| **1.3.0 (70)** | `f71e27f` | [6aade6f4…](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/6aade6f4-3039-4036-b8ca-0f3883ee9ee9) — Review Demo + monitor metering | [auto-submit](https://expo.dev/accounts/djoek47/projects/choremaxx/submissions/c08c6e8c-05b5-43e8-96e3-9befaaa594b7) (free-tier queue) |

Parent line (v18): **1.3.0 (69)** finished — ASC Beta App Review refused (no demo). Do not promote 69.  
Logs (69): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/7777ca77-4525-4cc0-977e-00197e2aeae5

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
3. `20260916230000_ai_usage_events_metering.sql` — **user applies** (required for spend logs; TF70 ships without waiting)

## Verify in app

Settings build tip: `make-v19 · login-review-demo · tf71`  
Sign in (TestFlight): **Apple Review demo** row with email/password + tap to fill.

## Notes for agents

- Design source remains Figma Make `4J6d4LW335tDyEDpqq3VD1`.
- Product SoT: `docs/product-context.md`, `docs/ux-design-system.md`, `docs/technical-blueprint.md`.
- Sync/push reference still: `docs/sync-and-notifications-v18.md` until a v19 sync doc is warranted.
- Keep `EXPO_PUBLIC_DATA_MODE=mock` for Expo Go cloud work unless user asks for Supabase.
- Stay on **`cursor/make-v19`** only (see `.cursor/rules/single-shipping-branch.mdc`).

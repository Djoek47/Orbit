# Choremaxx Make v21

**Branch:** `cursor/make-v21` — **canonical shipping line**  
**Follows:** `cursor/make-v20` (TestFlight **1.3.0 (73)**)  
**Baseline tip:** inherits all make-v20 work + today’s ActEvent / Pass 1 / expired-purge / mock-reward stack.

## Cut checklist

| Check | Status |
|-------|--------|
| Code tree includes make-v20 tip | Yes |
| ActEvent product meter + Spoken cost rails (#65) | Yes |
| Pass 1 leftovers (#67) | Yes |
| 7-day expired occurrence purge (#66) | Yes |
| Mock vault reward persistence (#64) | Yes |
| Canonical agent rules → `cursor/make-v21` | `AGENTS.md`, `single-shipping-branch.mdc`, `no-improvise-shipped-baseline.mdc` |

## What’s new vs v20

### Poppins metering (WO5 §1–3 + rails)
- `ActEvent` product meter (`act_events` migration, `act-ledger.ts`, charge on IUI commit)
- Spoken / Live cost rails (idle 15s/30s, soft check-in removal, Realtime `retention_ratio`)
- AiUsage length fields (`session_id`, `turn_index`, `duration_ms`) with writers wired for turn plots
- Keep `unique(client_key)` append-on-first-write (no COGS double-count)

### Pass 1 leftovers (WO3/5/6/7/8 slices)
- Half-duplex uplink: mute mic from `response.created` through done/cancel (including tool thinking)
- WO8 tool schema: title descriptions + optional title; remove four `Task`/`Item` placeholders
- Groceries chrome on shared primitives (`SearchBar` typeahead, `EmptyState`, `GlassCard`, `PageEyebrow`); clothing/other not browsable; Clothing lane removed
- Settings member card: status + next action (**Not set up yet → Set up device**)

### Expired tasks
- `purge_expired_occurrences()` + hourly `pg_cron`, client 7-day Expired tab filter + notice
- House Rules **DEAD-08** (schema `4.1.0`)

### Rewards
- Mock-mode vault rewards persist across reload

## Included PRs (merged into this tip)

| PR | Branch | Topic |
|----|--------|--------|
| #65 | `cursor/act-meter-realtime-cogs-c30d` | ActEvent meter + Spoken rails + AiUsage length cols |
| #67 | `cursor/pass1-leftovers-c30d` | Pass 1 eight leftovers |
| #66 | `cursor/expired-auto-delete-c30d` | 7-day expired purge |
| #64 | `cursor/mock-reward-persist-c30d` | Mock reward persistence |

## Out of scope (still queued)

- WO4 compound intent / composite batch preview (needs design)
- WO8 §3 `validateAct`
- WO7 §3–7 `list_kind` Shopping list
- WO6 Part A shared-device session switch + rest of Part B
- WO5 §4–6 admin usage breakdown, mode toggles, onboarding voice question
- WO3 map scenes (needs design)
- `pg_cron` for `poppins-monitor` (ops, not in migrations)

## Apple Review Demo (Guideline 2.1(a))

Same as v20 — Sign in (TestFlight):

- **User Name:** `review@choremaxx.app`
- **Password:** `ReviewDemo2026!`

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| _(pending)_ | `cursor/make-v21` | — | — |

## TestFlight env (`eas.json`)

Same as v20:

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

Carry-forward from v20, plus:

1. `20260918010000_act_events_ai_usage_length.sql` — ActEvent ledger + AiUsage length fields
2. `20260918020000_purge_expired_occurrences.sql` — expired purge + cron
3. Prior v20 migrations in `docs/choremaxx-make-v20.md`

## Verify in app

Settings build tip: `make-v21 · act-meter · pass1 · expired-purge`  
Expired tab: notice + 7-day window; empty → “Nothing expired. Nice work.”  
Groceries: no clothing tile/lane; EmptyState when list empty.  
Settings member: child without device shows **Not set up yet** + **Set up device**.  
Spoken: mic stays muted through tool turns.

## Notes for agents

- Stay on **`cursor/make-v21`** only (see `.cursor/rules/single-shipping-branch.mdc`).
- Do not create `cursor/…-c30d` sprawl unless the user asks.
- Mode vocabulary in product copy: Quiet/Spoken × Guided/Direct; code still uses `PoppinsActMode` `silent|spoken|live` via `axesFromPoppinsMode`.

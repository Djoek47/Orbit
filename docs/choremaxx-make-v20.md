# Choremaxx Make v20

**Branch:** `cursor/make-v20` — **canonical shipping line**  
**Follows:** `cursor/make-v19` (TestFlight **1.3.0 (71)**)  
**Baseline tip:** inherits all make-v19 work + WO2 IUI/token top-ups.

## Cut checklist

| Check | Status |
|-------|--------|
| Code tree includes make-v19 tip | Yes |
| WO2 IUI: extractors, fuzzy, echo, settle | Yes |
| Token top-ups + grants ledger | Yes |
| Top-up / meter UI matches Premium (Bricolage + Orbit) | Yes |
| Canonical agent rules → `cursor/make-v20` | `AGENTS.md`, `single-shipping-branch.mdc`, `no-improvise-shipped-baseline.mdc` |

## What’s new vs v19

### IUI (WO2)
- Additive chore/grocery extractors (no debris titles)
- Closed-set fuzzy catalog/roster match + provisional confidence
- Echo defence: AEC on mic, mute uplink while speaking, user-origin `hearAndDrive`
- Longer settle linger + deliberate result-mark entrance
- Homework drafts stay on `homework_compose` (no calendar mis-route)

### Billing
- Consumable token packs (`IAP_CONSUMABLES`)
- `token_grants` migration + `grant-token-pack` edge function
- Premium / Settings / Poppins meter + `TokenTopUpPicker` (Premium-matched type/layout)

## Apple Review Demo (Guideline 2.1(a))

Same as v19 — Sign in (TestFlight):

- **User Name:** `review@choremaxx.app`
- **Password:** `ReviewDemo2026!`

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (73)** | `cursor/make-v20` | [a04d6525…](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/a04d6525-050c-42ca-857e-b3a1c2f7d127) — make-v20 WO2 + top-ups | [auto-submit](https://expo.dev/accounts/djoek47/projects/choremaxx/submissions/0d077f8e-0074-41d7-8d42-ce42a34b58be) |

## TestFlight env (`eas.json`)

Same as v19:

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

Carry-forward from v19, plus:

1. `20260917040000_token_grants.sql` — required for top-up balances
2. `20260916230000_ai_usage_events_metering.sql` — spend logs
3. Prior v18/v19 migrations listed in `docs/choremaxx-make-v19.md`

## Verify in app

Settings build tip: `make-v20 · wo2-tokens · tf73`  
Premium → Buy more actions → pack picker matches Premium display type.  
Poppins settle mark: longer linger, spring entrance.

## Notes for agents

- Stay on **`cursor/make-v20`** only (see `.cursor/rules/single-shipping-branch.mdc`).
- ASC consumable product IDs must exist before live top-up purchases work on device.
- Do not create `cursor/…-c30d` sprawl unless the user asks.

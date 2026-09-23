# Choremaxx Make v23

**Branch:** `cursor/make-v23` — **canonical shipping line**  
**Follows:** `cursor/make-v22`  
**Baseline tip:** inherits make-v22 plus task proof sheets, Sidekick Poppins opt-in, Poppins Base/Max glass orb, and the tour back/close pass.

## Cut checklist

| Check | Status |
|-------|--------|
| Code tree includes make-v22 | Yes |
| Task proof request + sidekick reply sheets | Yes |
| Skip today / Mark not done minimal patches | Yes |
| Sidekick Poppins AI off until an admin enables it | Yes |
| Poppins Base / Max + glass water orb | Yes |
| Tour Back, close-for-good, no Continue after done | Yes |
| Canonical agent rules → `cursor/make-v23` | `AGENTS.md`, `single-shipping-branch.mdc`, `no-improvise-shipped-baseline.mdc` |

## What’s new vs v22

### Tasks
- iOS-style proof request and sidekick reply sheets
- Skip today and Mark not done use a minimal patch so the row actually updates

### Sidekick AI
- `sidekick_poppins_ai` defaults off. The Poppins tab and Speak stay hidden until an admin turns it on
- Migration: `supabase/migrations/20260923060000_sidekick_poppins_ai.sql`

### Poppins
- Two modes only: **Poppins Base** (quiet, 1 action) and **Poppins Max** (speaks back)
- Custom is a caption when Advanced is tuned, not a third card
- Speak orb is glass: water is actions left today, outer glow is the household month (admins). Sidekicks see their own day
- Keyboard thread keeps a small orb in the header

### Tour
- Back moves to the previous step, including the last step of the previous chapter
- Home steps navigate to the index tab only, so Back from Tasks returns to Home
- Done hides Continue, Restart, and Getting Started
- Continue, the upgrade offer, and Exit tour can be closed for good
- Replay stays in Settings → Help (`Take the tour again`, `Replay a part`, `Show the checklist`)

## Apple Review Demo (Guideline 2.1(a))

Same as v21 — Sign in (TestFlight):

- **User Name:** `review@choremaxx.app`
- **Password:** `ReviewDemo2026!`

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (79)** failed | `cursor/make-v23` @ `bbfc01b` | [4e1a3b76](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/4e1a3b76-7f33-4ffa-8d3a-6f2c53916b11) — Xcode 26.6, `expo-av` did not compile | not submitted |
| **1.3.0 (80)** queued | `cursor/make-v23` @ `8e33b2a` | [d2c64541](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/d2c64541-3e6b-4325-995a-882ec869de84) — **Xcode 26.6 / iOS 26 SDK**, `expo-audio` | [bc5afef5](https://expo.dev/accounts/djoek47/projects/choremaxx/submissions/bc5afef5-7508-4564-ae18-7d1f413591cb) auto-submit |

## Apple SDK

TestFlight and production iOS builds use EAS image `macos-tahoe-26.5-xcode-26.6` (Xcode 26.6, iOS 26 SDK). That is the SDK Apple has required for App Store Connect since April 28, 2026.

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

1. `20260923060000_sidekick_poppins_ai.sql` — Sidekick Poppins flag, default off
2. `20260923120000_tasks_status_skip_undo.sql` — allow `cancelled` / `expired` and backfill completion timestamps (applied on Choremaxx-Staging 2026-09-23)
3. Carry-forward migrations listed in `docs/choremaxx-make-v21.md` and `docs/choremaxx-make-v20.md`

## Verify in app

Settings build tip: `make-v23 · …`  
Poppins settings: Base and Max cards, Advanced behind its own row.  
Speak: glass orb, Base/Max pills, keyboard thread.  
Tour: Back works across chapters; Exit, Continue close, and Done do not bring the prompt back.  
Sidekick with AI off: no Poppins tab.

## Notes for agents

- Stay on **`cursor/make-v23`** only (see `.cursor/rules/single-shipping-branch.mdc`).
- Do not create `cursor/…-c30d` sprawl unless the user asks.

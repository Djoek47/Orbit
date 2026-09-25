## Design 8 (2026-08-01)

- Visual SoT switched to Make file `nwBB1pEqZMWxsm6WE7dFeS` (Design Orbit AI App — copie).
- Mirrored: ItineraryScreen (Smart Trips + My Places + Pickup Summary glass), OnboardingScreen, AdminScreen, theme.css, gameData.
- Prior v7 file key retained as `previousFileKey` in SYNC_STATE.json.

# Make sync changelog

## 2026-07-20 — Make v7 / Choremaxx

- Brand rename: **Choremaxx** (Make v7 final feature set).
- Primary tabs: Home · Tasks · Plan · Rewards · Nova.
- Plan = Calendar + Itineraries subnav (`app/(tabs)/calendar.tsx`).
- Rewards Center = Rewards / Allowance / Rankings (`app/(tabs)/rewards.tsx`).
- Onboarding: role + motivation (`app/onboarding.tsx`) + `ChoremaxxLogo`.
- Theme primary → `#3BB5F0`; background → `#070D1C`.
- Groceries demoted from primary tab (still reachable).
- Synced key Make sources into `design/make/source/` (App, logo, onboarding, rewards, theme).

## 2026-07-15 — bootstrap

- Created design registry and `SYNC_STATE.json`.
- No Make source snapshot yet (await first authenticated Figma MCP sync).

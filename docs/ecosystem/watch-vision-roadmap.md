# Orbit ecosystem follow-ons (Phase F)

Primary App Store target is the **iPhone** Orbit app. These surfaces ship after that release.

## Apple Watch

Goals:

- Complication: Household Momentum %
- Glance: today’s assigned tasks + missing groceries count
- Actions: mark task complete, mark grocery purchased

Approach:

- Prefer a dedicated watchOS target once Expo/EAS watch support (or a thin native companion) is available for the project.
- Reuse Supabase auth session transfer via WatchConnectivity / app group from the phone app.
- Keep schema unchanged; watch is a thin client over the same repositories/API.

## iPad

- Mostly free with React Native layouts; add wider breakpoints for Home command center and analytics dashboards.
- Test multitasking / Stage Manager before promoting iPad as a first-class SKU.

## Vision Pro

- Separate spatial shell later; start with windowed Orbit Home + Nova conversation.
- Do not block phone App Store on visionOS.

## Broader smart home

- Phone surfaces already list devices/scenes (`smart_home_devices`, `smart_home_scenes`).
- Next: Matter / Home Assistant adapters as Edge Functions that mutate device state and broadcast via Realtime.

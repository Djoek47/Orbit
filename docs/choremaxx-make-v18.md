# Choremaxx Make v18

**Branch:** `cursor/make-v18` — **stay here until explicitly cut to v19**  
**Follows:** `cursor/make-v17` (TestFlight **1.3.0 (61)**)

## Aggregated since make-v17 (all on this branch)

| Area | What shipped |
|------|----------------|
| **Simplify invites** | Admin-only Get Started; scan-to-join; immediate connection paths |
| **Welcome** | “Scan to build household” copy |
| **Member realtime** | `household_members` Supabase publication; admin roster refresh on join |
| **Member connection** | Green badge when Sidekick/co-admin connects; 12s Settings poll |
| **Homework & Tasks MVP** | Assign-homework flow, `homeworkSubject`, kid UI, proof model, Plan focus, notifications, Sidekick 5s Tasks poll |
| **Settings → Members** | In-place `AddMemberSheet` + `AddMemberRow` (no navigation away); `SharedIpadCard`; `SettingsMemberCard` with homework proof toggle |
| **Household stack (from v17)** | Multi-household switch/delete (TestFlight hides switch via `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH`) |

## TestFlight

**Build 63** was uploaded prematurely during aggregation — **do not build again** until the full v18 stack is verified in Expo Go / staging.

When ready for the next IPA, bump from this branch only.

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

1. `20260831120000_household_members_realtime.sql`
2. `20260831140000_homework_subject.sql`
3. `20260831140100_calendar_event_targeting.sql`

Plus any v17 migrations not yet applied — see `docs/choremaxx-make-v17.md`.

## Verify in app

Settings build tip: `make-v18 · homework-mvp · member-realtime · simplify-invites`

Settings → Members → **Add member** opens sheet in place; after save, invite sheet opens.

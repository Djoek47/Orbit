# Choremaxx Make v18

**Branch:** `cursor/make-v18`  
**Follows:** `cursor/make-v17` (TestFlight **1.3.0 (61)**)  
**App version:** `1.3.0` (EAS `autoIncrement` on production/testflight profile)

Shipping cut aggregating simplify-invites, member roster realtime, and Homework & Tasks MVP hardening.

---

## Highlights

- **Simplify invites** — admin-only Get Started, scan-to-join, immediate connection paths
- **Member roster realtime** — `household_members` on Supabase realtime; admin roster refreshes when Sidekicks/co-admins join
- **Homework & Tasks MVP** — assign homework flow, subject field, kid-readable list, proof model (Revision C), Plan calendar focus, task-assigned notifications, Sidekick 5s Tasks poll

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

Run in order after v17 migrations:

1. `20260831120000_household_members_realtime.sql`
2. `20260831140000_homework_subject.sql`
3. `20260831140100_calendar_event_targeting.sql`

## Edge functions to redeploy (if join/homework paths changed)

- `join-household`
- `sidekick-sync`

## Verify in TestFlight

Settings → build tip should read **`make-v18 · homework-mvp · member-realtime · simplify-invites`**.

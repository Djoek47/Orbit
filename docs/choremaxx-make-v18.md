# Choremaxx Make v18

**Branch:** `cursor/make-v18` — **stay here until explicitly cut to v19**  
**Follows:** `cursor/make-v17` (TestFlight **1.3.0 (61)**)  
**Previous premature upload:** **1.3.0 (63)** — missing Members UI unification + Sidekick Plan add (build before `58a3285` / `148c0e9`).

## Aggregated since make-v17 (all on this branch)

| Area | What shipped |
|------|----------------|
| **Simplify invites** | Admin-only Get Started; scan-to-join; immediate connection paths |
| **Welcome** | “Scan to build household” copy |
| **Join policy** | Removed join approval — Sidekicks and members connect immediately on invite |
| **Member realtime** | `household_members` Supabase publication; admin roster refresh on join |
| **Member connection** | Green badge when Sidekick/co-admin connects; live refresh hooks |
| **Homework & Tasks MVP** | Assign-homework flow, `homeworkSubject`, kid UI, proof model, Plan focus, notifications, Sidekick 5s Tasks poll |
| **Settings → Members** | In-place `AddMemberSheet` + `AddMemberRow`; `SharedIpadCard`; unified `HouseholdMembersRoster` |
| **Members UI (latest)** | Settings and `/household-members` share one roster; calmer member cards; no duplicate Manage CTA |
| **Sidekick Plan add** | Plan + menu: homework instant; school/practice/family events with optional admin approval |
| **Sidekick sync** | Task sync, notifications, safe sign-out restore |
| **expo-insights** | Native cold-start analytics (needs this build, not 61/63) |
| **Household stack (from v17)** | Multi-household switch/delete (TestFlight hides switch via `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH`) |

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

**v18 (required for full feature set):**

1. `20260831120000_household_members_realtime.sql`
2. `20260831140000_homework_subject.sql`
3. `20260831140100_calendar_event_targeting.sql`
4. `20260831150000_calendar_event_approval.sql`
5. `20260829200000_remove_join_approval.sql` (if join approval still enabled in DB)

**v17 (if not yet applied):** see `docs/choremaxx-make-v17.md` and `supabase/migrations/PENDING_APPLY_ON_STAGING.sql`.

## Edge functions to redeploy (if changed since last deploy)

- `join-household`
- `complete-profile-join`
- `redeem-member-invite`

## Verify in app

Settings build tip: `make-v18 · sidekick-plan-add · homework-mvp · member-realtime`

Smoke checklist:

1. Settings → Members — Add member sheet in place; roster matches Members modal
2. Plan → + → Homework (Sidekick instant) / School (approval if locked)
3. Sidekick joins household — admin roster badge turns green without manual refresh
4. Tasks → Homework tab → Assign homework (admin)

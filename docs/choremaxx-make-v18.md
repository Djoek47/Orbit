# Choremaxx Make v18

**Branch:** `cursor/make-v18` — **stay here until explicitly cut to v19**  
**Follows:** `cursor/make-v17` (TestFlight **1.3.0 (61)**)  
**Previous premature upload:** **1.3.0 (63)** — missing Members UI unification + Sidekick Plan add (build before `58a3285` / `148c0e9`).

## Aggregated since make-v17 (all on this branch)

| Area | What shipped |
|------|----------------|
| **Simplify invites** | Admin-only Get Started; scan-to-join; immediate connection paths |
| **Welcome** | “Scan to join household” copy |
| **Join policy** | Removed join approval — Sidekicks and members connect immediately on invite |
| **Member realtime** | `household_members` Supabase publication; admin roster refresh on join |
| **Member connection** | Green badge when Sidekick/co-admin connects; live refresh hooks |
| **Homework & Tasks MVP** | Assign-homework flow, `homeworkSubject`, kid UI, proof model, Plan focus, notifications, Sidekick 5s Tasks poll |
| **Settings → Members** | In-place `AddMemberSheet` + `AddMemberRow`; `SharedIpadCard`; unified `HouseholdMembersRoster` |
| **Members UI (latest)** | Settings and `/household-members` share one roster; calmer member cards; no duplicate Manage CTA |
| **Sidekick Plan add** | Plan + menu: homework instant; school/practice/family events with optional admin approval |
| **Sidekick sync** | Task sync, notifications, safe sign-out restore |
| **Live sync + push** | 3s Sidekick poll app-wide; calendar in sync; refresh buttons; member-scoped Expo push |
| **Session + presence** | Sidekick session survives sign-out; no Rivera mock bleed; last_seen roster; re-share invite |
| **Task reminders** | Admin Send reminder on task detail → inbox + push with streak-at-risk copy |
| **expo-insights** | Native cold-start analytics (needs this build, not 61/63) |
| **Household stack (from v17)** | Multi-household switch/delete (TestFlight hides switch via `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH`) |

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (65)** | `4b51fa9` | `c6e82ae4-1784-4f1c-beb5-ad93c7626193` | `297a5534-5c74-4d6d-bb66-6814fc07bb94` |
| **1.3.0 (64)** | `ae7a1cd` | `9ceab14d-05d6-4284-82ec-7ee84c73153d` | `d3f38930-a581-4f91-95c6-92989b81d480` |

Build logs (65): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/c6e82ae4-1784-4f1c-beb5-ad93c7626193

**1.3.0 (65)** includes live sync, member push, session/presence, task reminders, welcome copy fix.

**1.3.0 (63)** was premature (missing Members UI + Sidekick Plan). **1.3.0 (61)** = make-v17.

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
6. `20260901120000_member_push_tokens.sql` (Sidekick push tokens)
7. `20260901130000_member_last_seen.sql` (roster Connected / Disconnected)

**v17 (if not yet applied):** see `docs/choremaxx-make-v17.md` and `supabase/migrations/PENDING_APPLY_ON_STAGING.sql`.

## Edge functions to redeploy (if changed since last deploy)

- `join-household`
- `complete-profile-join`
- `redeem-member-invite`
- `sidekick-sync` (now includes calendar events)
- `register-sidekick-push`
- `dispatch-member-push`

Set secret if missing: `EXPO_ACCESS_TOKEN` — **same Expo access token as local `EXPO_TOKEN`** (not a new login). With `SUPABASE_ACCESS_TOKEN` set: `npm run supabase:sync-expo-push-secret`.

## Two-phone live sync test

| Step | Expected |
|------|----------|
| Admin assigns task to Sidekick, Sidekick app open | Task within ~3s; local banner |
| Same, Sidekick app backgrounded | OS push within a few seconds |
| Admin adds calendar event | Sidekick Plan updates within ~3s |
| Tap sync icon on Tasks or Plan | Immediate reload |
| Sidekick kill + reopen | Latest tasks/events on restore |

## Verify in app

Settings build tip: `make-v18 · live-sync · session-presence · task-reminders`

Smoke checklist:

1. Settings → Members — Add member sheet in place; roster matches Members modal
2. Plan → + → Homework (Sidekick instant) / School (approval if locked)
3. Sidekick joins household — admin roster badge turns green without manual refresh
4. Tasks → Homework tab → Assign homework (admin)

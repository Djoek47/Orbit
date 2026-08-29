# Choremaxx Make v17

**Branch:** `cursor/make-v17`  
**Follows:** `cursor/choremaxx-make-v15` (TestFlight **1.3.0 (56)**)  
**App version:** `1.3.0` (EAS autoIncrement)

Aggregate of today's connection / members / household stack:

- **Member connection v16** — join flow, plan calendar, invite paths
- **Simplify invites** — two join paths + admin approval toggle
- **Admin member connection** — profile creation, connection badges
- **Household switch + delete** — multi-household switching, safe deletion (TestFlight: switch disabled via `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH`)
- **Sidekick Settings + House Rules** — interactive home card, Sidekick settings polish
- **Auto-approval / join policy** — `joinApprovalRequired`, per-member `joinPreApproved`, Members UX, Get Started roster policy, Supabase-only release (`__DEV__` mock gate)

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`
- `EXPO_PUBLIC_DISABLE_HOUSEHOLD_SWITCH=1`

## SQL to apply on staging (if missing)

Run in order:

1. `20260828000000_join_approval_required.sql`
2. `20260828010000_member_planned_tasks.sql`
3. `20260828120000_household_soft_delete.sql`
4. `20260829120000_join_pre_approved.sql`

Helper: `supabase/migrations/PENDING_APPLY_ON_STAGING.sql`

## Edge functions to redeploy

- `join-household`
- `complete-profile-join`
- `redeem-member-invite`

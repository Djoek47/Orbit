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
| **Sidekick writes (TF66+)** | Edge functions: complete/proof/homework, grocery add, calendar create; admin notify from edge |
| **Push admin (TF66+)** | `audienceRoles` → member IDs; push tap deep links; N19 homework ready |
| **Presence UI (TF66+)** | Last-seen timestamp on Re-share invite pill; Settings Members live refresh |
| **Task reminders** | Admin Send reminder on task detail → inbox + push with streak-at-risk copy |
| **expo-insights** | Native cold-start analytics (needs this build, not 61/63) |
| **Household settings sync (TF67+)** | Full settings poll to Sidekick; edge enforcement; unified inbox |
| **Sidekick unlock splash (TF67+)** | Brand opening lock screen replaces iPad picker on personal Sidekick devices |
| **Button hardening (TF67+)** | OrbitButton loading/haptic; settings toggle guards |
| **Task expiry (TF68+)** | Server + client expiry at 23:59; Sidekick/admin Expired tab stays in sync |
| **Inbox dismiss (TF68+)** | Admin/Sidekick/co-admin dismiss persists (JWT wins, tombstones) |
| **Reward history (TF68+)** | History from synced redemptions + dismiss X |

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (68)** | `5f276c0` | `0f45fa19-065d-408b-b24a-776b79605d6d` | `50122f55-5d4e-4fbc-937a-59e2035a47a5` |
| **1.3.0 (67)** | `b28c80f` | `25dc979d-f756-4a37-b45c-fd4cac7663ad` | `0954a327-bd67-4bb6-9a0d-0000a6e16d2c` |
| **1.3.0 (66)** | `ce64f4d` | `27845bec-c579-489c-9176-d0a9e3465c69` | `b91cdea1-3c14-4daa-b326-bd5eb96bd3d1` |
| **1.3.0 (65)** | `4b51fa9` | `c6e82ae4-1784-4f1c-beb5-ad93c7626193` | `297a5534-5c74-4d6d-bb66-6814fc07bb94` |
| **1.3.0 (64)** | `ae7a1cd` | `9ceab14d-05d6-4284-82ec-7ee84c73153d` | `d3f38930-a581-4f91-95c6-92989b81d480` |

Build logs (68): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/0f45fa19-065d-408b-b24a-776b79605d6d

Build logs (67): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/25dc979d-f756-4a37-b45c-fd4cac7663ad

Build logs (66): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/27845bec-c579-489c-9176-d0a9e3465c69

Build logs (65): https://expo.dev/accounts/djoek47/projects/choremaxx/builds/c6e82ae4-1784-4f1c-beb5-ad93c7626193

**1.3.0 (68)** — expiry · inbox-dismiss · reward-history · tf68 (today’s fixes).

**1.3.0 (67)** — inbox-unify · settings-sync · sidekick-unlock · button-harden · tf67 (see `docs/sync-and-notifications-v18.md`).

**1.3.0 (66)** — sidekick-writes · presence-ui · push-admin · sync-100 (see `docs/sync-and-notifications-v18.md`).

**1.3.0 (65)** includes live sync, member push, session/presence, task reminders, welcome copy fix. **Does not include** Sidekick complete via edge (client fix landed after 65).

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

Deploy Sidekick functions with `--no-verify-jwt`:

```bash
npx supabase functions deploy sidekick-sync --no-verify-jwt
npx supabase functions deploy sidekick-task-action --no-verify-jwt
npx supabase functions deploy sidekick-grocery-action --no-verify-jwt
npx supabase functions deploy sidekick-event-action --no-verify-jwt
npx supabase functions deploy register-sidekick-push --no-verify-jwt
npx supabase functions deploy dispatch-member-push
```

| Function | Purpose |
|----------|---------|
| `sidekick-sync` | 3s poll read + `last_seen_at` |
| `sidekick-task-action` | `complete`, `submit_proof`, `create_homework` + admin notify |
| `sidekick-grocery-action` | `add_item` (requires `sidekick_grocery_add`) |
| `sidekick-event-action` | `create_event` + admin notify on pending approval |
| `register-sidekick-push` | Expo token by `member_id` |
| `dispatch-member-push` | Push to `audienceMemberIds` |

Also redeploy if changed: `join-household`, `complete-profile-join`, `redeem-member-invite`.

Set secret if missing: `EXPO_ACCESS_TOKEN` — **same Expo access token as local `EXPO_TOKEN`** (not a new login). With `SUPABASE_ACCESS_TOKEN` set: `npm run supabase:sync-expo-push-secret`.

Full sync/notification reference: **`docs/sync-and-notifications-v18.md`**

## Two-phone live sync test

| Step | Expected |
|------|----------|
| Admin assigns task to Sidekick, Sidekick app open | Task within ~3s; local banner |
| Same, Sidekick app backgrounded | OS push within a few seconds |
| Admin adds calendar event | Sidekick Plan updates within ~3s |
| Tap sync icon on Tasks or Plan | Immediate reload |
| Sidekick kill + reopen | Latest tasks/events on restore |

## Verify in app

Settings build tip: `make-v18 · sidekick-writes · presence-ui · push-admin · sync-100`

Smoke checklist:

1. Settings → Members — Add member sheet in place; roster matches Members modal
2. Plan → + → Homework (Sidekick instant) / School (approval if locked)
3. Sidekick joins household — admin roster badge turns green without manual refresh
4. Tasks → Homework tab → Assign homework (admin)
5. Sidekick complete task → admin push + inbox within seconds (TF66+)
6. Re-share invite row shows `· 5m ago` when disconnected (TF66+)

## Two-phone QA matrix (TF66)

| Step | Phone 1 (admin) | Phone 2 (Sidekick/co-admin) | Pass |
|------|-----------------|----------------------------|------|
| Assign task | Creates task | Appears ≤3s; push if backgrounded | |
| Complete task | Sees completion ≤3s; push | Celebration + persists | |
| Add calendar event | Plan updates | Sidekick Plan ≤3s | |
| Sidekick homework add | Tasks/Plan ≤3s | Instant on Sidekick | |
| Sidekick grocery add | List updates | If `sidekickGroceryAdd` enabled | |
| Re-share invite row | Shows `· 5m ago` when disconnected | — | |
| Send task reminder | — | Sidekick push + inbox | |
| Push tap | Opens task/plan/rewards | Same | |
| Co-admin sync | Assign task | Co-admin phone ≤3s | |

Copy for staging ops: `docs/sync-and-notifications-v18.md`

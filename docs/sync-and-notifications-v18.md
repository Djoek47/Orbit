# Sync & Notifications — Make v18

Reference for two-phone TestFlight validation and staging ops.

## Role × auth × sync matrix

| Role | Auth | Read sync | Writes |
|------|------|-----------|--------|
| Owner | Supabase JWT | Realtime (9 tables) + pull refresh | Repositories + RLS |
| Co-admin | Supabase JWT | Realtime + **3s poll fallback** | Same as owner |
| Sidekick | Profile code (`CMX-NAME`) | **3s poll** `sidekick-sync` | Edge functions only |
| Sidekick session | AsyncStorage `@orbit/sidekick_session.v1` | Poll via saved code | Edge functions |

### Poll intervals

| Hook | Interval | Who |
|------|----------|-----|
| `useSidekickLiveSync` | 3s | Sidekick, co-admin, profile-code session |
| `useMembersLiveRefresh` | 12s on focus | Admin roster (Settings + Members modal) |
| `useHouseholdRefresh` | Pull / sync icon | All roles |

### Realtime tables

`tasks`, `grocery_items`, `calendar_events`, `household_members`, `rewards`, `badges`, `notifications`, `reward_redemptions`, `smart_home_devices`

## Edge functions (Sidekick writes)

Deploy with `--no-verify-jwt`:

```bash
npx supabase functions deploy sidekick-sync --no-verify-jwt
npx supabase functions deploy sidekick-task-action --no-verify-jwt
npx supabase functions deploy sidekick-grocery-action --no-verify-jwt
npx supabase functions deploy sidekick-event-action --no-verify-jwt
npx supabase functions deploy register-sidekick-push --no-verify-jwt
npx supabase functions deploy dispatch-member-push
```

| Function | Actions |
|----------|---------|
| `sidekick-sync` | Read: tasks, calendar, groceries, rewards, notifications, members; updates `last_seen_at` |
| `sidekick-task-action` | `complete`, `submit_proof`, `create_homework` + admin notify |
| `sidekick-grocery-action` | `add_item` (requires `sidekick_grocery_add`) |
| `sidekick-event-action` | `create_event` (approval pending → admin notify) |
| `register-sidekick-push` | Save Expo token by `member_id` |
| `dispatch-member-push` | Expo push to `audienceMemberIds` |

**Secrets:** `EXPO_ACCESS_TOKEN` on Supabase (same value as local `EXPO_TOKEN`).

## Notification delivery

```
Action → pushNotification() → notifications row
  → resolve audienceRoles → audienceMemberIds
  → dispatchMemberPush (Expo)
  → presentLocalBanner (foreground, unless quiet hours)
```

| Event | Push target | Sidekick edge notify |
|-------|-------------|----------------------|
| Task assigned | Sidekick `member_id` | — |
| Task completed | All admins | Yes (Sidekick complete) |
| Proof / homework submitted | All admins | Yes (Sidekick proof) |
| Task reminder | Sidekick | — |
| Grocery add (Sidekick) | All admins | Yes |
| Event pending approval | All admins | Yes |

Push tap → `NotificationTapBridge` → `getNotificationRoute()` deep link.

## Staging checklist

1. Apply v18 SQL migrations (see `docs/choremaxx-make-v18.md`)
2. Deploy edge functions (above)
3. Set `EXPO_ACCESS_TOKEN` — `npm run supabase:sync-expo-push-secret`
4. Two phones on TestFlight with `EXPO_PUBLIC_DATA_MODE=supabase`

## Two-phone QA matrix

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

Build tip in Settings: `make-v18 · sidekick-writes · presence-ui · push-admin · sync-100`

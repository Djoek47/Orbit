# Orbit Technical Blueprint

The source architecture docs target SwiftUI, but this project is Expo SDK 54. Preserve the system design while implementing with Expo Router and React Native.

## Stack Translation

- Client: Expo SDK 54, React Native, Expo Router.
- Runtime: Bun for package management and scripts.
- Backend target: Supabase.
- Database: PostgreSQL.
- Realtime: Supabase Realtime.
- Auth: Supabase Auth, later Apple Sign-In.
- Storage: Supabase Storage.
- Server logic: Supabase Edge Functions or an Orbit API layer.
- AI: OpenAI-backed Nova services, later realtime voice and tool calling.
- Notifications: Expo notifications for app implementation, APNs underneath for iOS delivery.

## Core Principles

- Household first: nearly every domain object belongs to a household, never only to a user.
- Multi-tenant isolation: each household can access only its own data.
- Realtime first: task, grocery, event, reward, and recommendation changes should sync live.
- Permission aware: owners, admins, adults, children, and guests have different capabilities.
- Explainable AI: Nova recommendations should be visible, reviewable, and reversible.
- Stress-reducing UX: every technical decision should preserve clarity and calm.

## Data Model

Core tables from the backend blueprint:

- `users`: account profile data.
- `households`: household name, type, owner, timezone, country.
- `household_members`: household/user link, role, status.
- `household_invites`: invite code/link, expiry, creator.
- `permissions`: role permission definitions.
- `tasks`: task definition and metadata.
- `task_assignments`: assigned user, due date/time, status.
- `task_checklists`: checklist rows.
- `task_proofs`: proof photos and submissions.
- `task_categories`: category name, icon, color.
- `mental_load_entries`: invisible-work tracking.
- `mental_load_scores`: member/category distribution.
- `grocery_items`: name, quantity, status, location, category.
- `grocery_categories`: grocery grouping.
- `grocery_purchase_history`: item purchases.
- `stores`: store metadata and location.
- `store_recommendations`: location-aware recommendations.
- `calendar_events`: date/time/location/category.
- `event_assignments`: responsible people for events.
- `schools`: school info.
- `school_schedules`: school hours and no-notification windows.
- `notifications`: scheduled or sent notifications.
- `notification_rules`: contextual notification rules.
- `rewards`: reward catalog.
- `reward_redemptions`: child redemption requests and approval state.
- `xp_transactions`: XP awards.
- `user_levels`: level/progress.
- `badges`: badge definitions.
- `user_badges`: earned badges.
- `household_scores`: Household Momentum snapshots.
- `challenges`: family challenges.
- `ai_briefings`: daily and weekly Nova briefings.
- `ai_recommendations`: Nova suggested actions.
- `analytics_events`: product analytics.

## Realtime Events

Realtime events should cover:

- Task created, assigned, completed, overdue, reassigned.
- Grocery item added, marked low/missing/purchased.
- Calendar event created, changed, assigned.
- Reward requested, approved, rejected.
- Household score updated.
- Nova briefing or recommendation created.

## Engines

Household Momentum:

- Inputs: task completion, grocery readiness, calendar preparedness, participation, mental-load balance, overdue work, streaks.
- Output: 0-100 household score.

Mental Load:

- Tracks remembering, planning, scheduling, assigning, buying, doing, and following up.
- Shows distribution by member and category.
- Powers Nova rebalancing suggestions.

Grocery Intelligence:

- Inputs: missing items, user location permission, nearby stores, shopping history.
- Output: suggested stop, estimated time, list, route placeholder.

School Awareness:

- Prevents notifications to children during class.
- Delivers child reminders after school.

Notifications:

- Types: tasks, groceries, events, rewards, AI alerts.
- Priorities: low, medium, high, critical.
- Logic: context-aware, schedule-aware, location-aware.

Analytics:

- Track task completion, participation, momentum, mental load, AI usage, retention.

## Security

- Use Row Level Security on every Supabase table.
- Access should be scoped to active household membership.
- Children have restricted access.
- Guests access only assigned resources.
- Requirements: encryption, audit logs, permission boundaries, data export, account deletion.

## Expo Implementation Notes

- Use Expo Go first; only introduce custom native builds when a required feature cannot run in Expo Go.
- Keep routes in `app/`; keep reusable components, hooks, types, services, and tokens outside `app/`.
- Prefer Expo Router stacks and tabs.
- Use `ScrollView` or lists with `contentInsetAdjustmentBehavior="automatic"` for route screens.
- Use `react-native-safe-area-context`, not React Native `SafeAreaView`.
- Use `expo-image` for images and future SF Symbol rendering.
- Keep Nova and Momentum visualizations native-rendered first; add 3D only where it creates meaning.

-- Track Sidekick / member app activity for admin roster presence.

alter table if exists public.household_members
  add column if not exists last_seen_at timestamptz;

create index if not exists household_members_last_seen_idx
  on public.household_members (household_id, last_seen_at desc nulls last);

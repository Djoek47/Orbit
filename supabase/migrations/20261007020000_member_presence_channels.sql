-- Split Sidekick (personal phone) vs shared-tablet presence.
-- SIDEKICKS "Connected" uses personal_last_seen_at.
-- Shared tablets "Who can use it" uses shared_last_seen_at + shared_active_on_device_id.

alter table public.household_members
  add column if not exists personal_last_seen_at timestamptz,
  add column if not exists shared_last_seen_at timestamptz,
  add column if not exists shared_active_on_device_id uuid;

comment on column public.household_members.personal_last_seen_at is
  'Last seen on a personal Sidekick phone (hostKind=sidekick).';
comment on column public.household_members.shared_last_seen_at is
  'Last seen while active on a shared tablet.';
comment on column public.household_members.shared_active_on_device_id is
  'Shared-device shell member id this person is currently active on, if any.';

-- Backfill: existing last_seen_at counts as personal until the next sync classifies it.
update public.household_members
set personal_last_seen_at = last_seen_at
where last_seen_at is not null
  and personal_last_seen_at is null;

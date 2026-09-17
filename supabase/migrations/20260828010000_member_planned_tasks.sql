-- Profile invites + planned tasks until a member connects on their device.
alter table if exists public.household_members
  add column if not exists profile_invite_code text;

create unique index if not exists household_members_profile_invite_code_idx
  on public.household_members (profile_invite_code)
  where profile_invite_code is not null;

alter table if exists public.household_members
  add column if not exists planned_task_library_ids jsonb not null default '[]'::jsonb;

comment on column public.household_members.planned_task_library_ids is
  'Task library ids chosen by admin during onboarding — materialized when member connects.';

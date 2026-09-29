-- Kid / shared-device profile invites (CMX-EMMA), distinct from household CMX-3486.
alter table if exists public.household_members
  add column if not exists profile_invite_code text;

create unique index if not exists household_members_profile_invite_code_idx
  on public.household_members (profile_invite_code)
  where profile_invite_code is not null;

comment on column public.household_members.profile_invite_code is
  'Per-person kid/shared-device invite (CMX-NAME). Household join codes live on household_invites.';

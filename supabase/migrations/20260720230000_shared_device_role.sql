-- Shared device profiles for phones/tablets used by multiple household people.
alter table public.household_members
  drop constraint if exists household_members_role_check;

alter table public.household_members
  add constraint household_members_role_check
  check (role in ('owner', 'admin', 'adult', 'child', 'guest', 'shared-device'));

alter table public.household_members
  add column if not exists shared_with_member_ids uuid[] default null;

comment on column public.household_members.shared_with_member_ids is
  'For shared-device roles: household_members.id values of people who use this device.';

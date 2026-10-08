-- Admin toggle: require approval before new members enter the household.
alter table public.households
  add column if not exists join_approval_required boolean not null default true;

-- Per-member pre-approval: skip pending join when household requires approval.
alter table public.household_members
  add column if not exists join_pre_approved boolean not null default false;

comment on column public.household_members.join_pre_approved is
  'When true, this member enters active immediately after accepting their invite.';

-- Apply on Supabase staging if not already run (in order).
-- Verify with queries at the bottom.

-- 1) Join approval household toggle
alter table public.households
  add column if not exists join_approval_required boolean not null default true;

-- 2) Member planned tasks + profile code index (from 20260828010000_member_planned_tasks.sql)
-- Run full migration file if planned_task_library_ids column is missing.

-- 3) Household soft delete (from 20260828120000_household_soft_delete.sql)
-- Run full migration file if deletion_scheduled_for column is missing.

-- 4) Per-member pre-approval
alter table public.household_members
  add column if not exists join_pre_approved boolean not null default false;

comment on column public.household_members.join_pre_approved is
  'When true, this member enters active immediately after accepting their invite.';

-- Verify
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'households' and column_name = 'join_approval_required';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'household_members' and column_name = 'join_pre_approved';

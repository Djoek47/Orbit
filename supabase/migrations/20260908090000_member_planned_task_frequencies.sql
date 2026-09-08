-- Frequency overrides for admin-planned tasks (Get Started / add member).
alter table if exists public.household_members
  add column if not exists planned_task_frequencies jsonb not null default '{}'::jsonb;

comment on column public.household_members.planned_task_frequencies is
  'Per library-task frequency chosen during onboarding — applied with planned_task_library_ids when member connects.';

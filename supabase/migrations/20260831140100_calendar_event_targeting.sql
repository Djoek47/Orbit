alter table if exists public.calendar_events
  add column if not exists household_wide boolean not null default false;

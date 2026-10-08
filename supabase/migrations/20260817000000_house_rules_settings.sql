-- House Rules v4 household settings (daily deadline + allowance amount requests).
alter table public.households
  add column if not exists daily_deadline text,
  add column if not exists daily_deadline_pending text,
  add column if not exists daily_deadline_applies_on date,
  add column if not exists allowance_requests_enabled boolean not null default true;

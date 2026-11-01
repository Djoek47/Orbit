-- New-device sign-in alerts.
--
-- One row per (person, device). The app sends a random per-install device id after each
-- sign-in (never a hardware id); the login-alert edge function inserts it, and when the row
-- is new it emails the person — and their household admins — that the account was opened on a
-- device it hasn't seen before. Server-only: clients cannot read or write this table.

create table if not exists public.login_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 80),
  device_name text,
  platform text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table public.login_devices enable row level security;
-- No policies: only the service role (the edge function) touches it.

comment on table public.login_devices is
  'Devices each person has signed in on. Written by the login-alert edge function only.';

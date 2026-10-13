-- Poppins metering: append-only usage log + monitor cron cursor.
-- Extends kinds for monitor/notify/realtime; drops household+client_key unique.

-- 1) Expand kind check
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_kind_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_kind_check
  check (kind in ('chat', 'voice', 'briefing', 'monitor', 'notify', 'realtime'));

-- 2) Extra columns for spend visibility
alter table public.ai_usage_events
  add column if not exists cached_input_tokens integer not null default 0;

alter table public.ai_usage_events
  add column if not exists audio_input_seconds numeric not null default 0;

alter table public.ai_usage_events
  add column if not exists audio_output_seconds numeric not null default 0;

alter table public.ai_usage_events
  add column if not exists surface text;

alter table public.ai_usage_events
  add column if not exists mode text;

-- 3) Append-only: unique client_key globally (idempotent retries), not per household.
-- Old unique (household_id, client_key) made upsert a dedupe table, not an event log.
alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_household_id_client_key_key;

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_household_id_client_key_unique;

-- Prefer a named unique on client_key alone
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_client_key_key'
  ) then
    alter table public.ai_usage_events
      add constraint ai_usage_events_client_key_key unique (client_key);
  end if;
end $$;

create index if not exists ai_usage_events_household_kind_occurred_idx
  on public.ai_usage_events (household_id, kind, occurred_at);

comment on table public.ai_usage_events is
  'Append-only Poppins spend events. client_key unique for idempotent inserts; do not upsert usd.';

-- 4) Rotating cursor for monitor cron (see functions README)
create table if not exists public.monitor_cron_cursor (
  id int primary key default 1 check (id = 1),
  after_household_id uuid,
  updated_at timestamptz not null default now()
);

insert into public.monitor_cron_cursor (id) values (1)
on conflict (id) do nothing;

comment on table public.monitor_cron_cursor is
  'Single-row cursor for poppins-monitor cron batches; wraps when batch empty.';

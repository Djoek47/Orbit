-- ActEvent product meter + AiUsageEvent length fields for Spoken diagnostics.
-- Prerequisite: 20260916230000_ai_usage_events_metering.sql (unique client_key, cached/audio cols).

-- 1) COGS length fields (session / turn growth visibility)
alter table public.ai_usage_events
  add column if not exists session_id text;

alter table public.ai_usage_events
  add column if not exists turn_index integer;

alter table public.ai_usage_events
  add column if not exists duration_ms integer;

comment on column public.ai_usage_events.session_id is
  'Spoken Realtime session id; groups turns for context-replay diagnostics.';
comment on column public.ai_usage_events.turn_index is
  '0-based turn within session_id.';
comment on column public.ai_usage_events.duration_ms is
  'Optional wall time for the provider call.';

-- 2) Product act ledger (user-facing tokens; charged on commit)
create table if not exists public.act_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_key text not null,
  member_id text not null,
  member_name text not null default '',
  act_kind text not null
    check (act_kind in (
      'task', 'grocery', 'event', 'homework',
      'itinerary_stop', 'place_save', 'complete', 'reward'
    )),
  voice text not null default 'quiet' check (voice in ('quiet', 'spoken')),
  control text not null default 'guided' check (control in ('guided', 'direct')),
  tokens integer not null default 0,
  outcome text not null default 'committed'
    check (outcome in ('committed', 'undone', 'vetoed', 'abandoned', 'failed')),
  utterance_chars integer not null default 0,
  turns integer not null default 0,
  beats_played integer not null default 0,
  slots_from_speech integer not null default 0,
  slots_from_touch integer not null default 0,
  slots_inherited integer not null default 0,
  latency_ms integer not null default 0,
  beat_id text,
  session_id text,
  session_seconds numeric,
  audio_in_seconds numeric,
  audio_out_seconds numeric,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_key)
);

create index if not exists act_events_household_occurred_idx
  on public.act_events (household_id, occurred_at);

create index if not exists act_events_household_member_idx
  on public.act_events (household_id, member_id, occurred_at);

alter table public.act_events enable row level security;

drop policy if exists act_events_select on public.act_events;
create policy act_events_select on public.act_events for select
  using (public.is_household_member(household_id));

drop policy if exists act_events_insert on public.act_events;
create policy act_events_insert on public.act_events for insert
  with check (public.is_household_member(household_id));

comment on table public.act_events is
  'Product act meter — weighted tokens charged on IUI commit. Not provider COGS.';

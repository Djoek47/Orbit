-- Household Poppins spend meter ($4 trip). Apply on staging so TestFlight
-- phones share one household total. Until this runs, the app still meters
-- locally on each device via AsyncStorage.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_key text not null,
  member_id text not null,
  member_name text not null default '',
  kind text not null check (kind in ('chat', 'voice', 'briefing')),
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  usd numeric(10, 4) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (household_id, client_key)
);

create index if not exists ai_usage_events_household_occurred_idx
  on public.ai_usage_events (household_id, occurred_at);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_select on public.ai_usage_events;
create policy ai_usage_events_select on public.ai_usage_events for select
  using (public.is_household_member(household_id));

drop policy if exists ai_usage_events_insert on public.ai_usage_events;
create policy ai_usage_events_insert on public.ai_usage_events for insert
  with check (public.is_household_member(household_id));

comment on table public.ai_usage_events is
  'Per-person Poppins spend. Household pauses at $4.00 so we can time real use.';

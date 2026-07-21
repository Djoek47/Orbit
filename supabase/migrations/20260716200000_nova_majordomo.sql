-- Nova majordomo: holiday windows, notification prefs, monitor recommendations helpers

alter table public.household_members
  add column if not exists away_start date,
  add column if not exists away_end date;

alter table public.households
  add column if not exists notification_prefs jsonb not null default '{
    "tasks": true,
    "itinerary": true,
    "groceries": true,
    "rewards": true,
    "deals": true,
    "plans": true,
    "xpFairness": true
  }'::jsonb;

comment on column public.household_members.away_start is 'Inclusive holiday/away start (YYYY-MM-DD); Nova Monitor skips nudges.';
comment on column public.household_members.away_end is 'Inclusive holiday/away end (YYYY-MM-DD).';
comment on column public.households.notification_prefs is 'Nova + Monitor notification category toggles.';

-- Ensure service role / edge can insert recommendations (RLS already member-scoped;
-- service role bypasses RLS. Add explicit insert policy for authenticated members too.)
drop policy if exists ai_recs_insert_member on public.ai_recommendations;
create policy ai_recs_insert_member on public.ai_recommendations
  for insert
  with check (public.is_household_member(household_id));

create index if not exists ai_recommendations_household_active_idx
  on public.ai_recommendations (household_id, status, created_at desc);

create index if not exists household_members_away_idx
  on public.household_members (household_id, away_start, away_end)
  where away_start is not null;

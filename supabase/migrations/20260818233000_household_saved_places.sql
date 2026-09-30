-- My Places: persist household saved locations (home, work, shops, …)
-- across app restarts. Client ids stay text (`place-home`) via client_key.

create table if not exists public.household_saved_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_key text not null,
  name text not null,
  kind text not null
    check (kind in (
      'home', 'work', 'school', 'shop', 'practice', 'family',
      'cafe', 'pickup', 'clothing', 'custom'
    )),
  address text not null default '',
  place_query text,
  lat double precision,
  lng double precision,
  emoji text,
  is_favorite boolean not null default false,
  pickup_item_names text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, client_key)
);

create index if not exists household_saved_places_household_id_idx
  on public.household_saved_places (household_id, sort_order);

alter table public.household_saved_places enable row level security;

drop policy if exists household_saved_places_all on public.household_saved_places;
create policy household_saved_places_all on public.household_saved_places
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop trigger if exists household_saved_places_set_updated_at on public.household_saved_places;
create trigger household_saved_places_set_updated_at
  before update on public.household_saved_places
  for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.household_saved_places;
exception when others then null;
end $$;

comment on table public.household_saved_places is
  'Household My Places pins used by trips, near-shop alerts, and pickup summaries.';

-- Family Time OS: itineraries, task templates, grocery barcode fields, reward extras.

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  date_key date not null,
  status text not null default 'active' check (status in ('draft', 'active', 'completed')),
  suggested_by_nova boolean not null default false,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('school', 'work', 'grocery', 'pickup', 'custom')),
  address text,
  place_query text,
  event_id uuid,
  grocery_list_id text,
  eta_minutes integer,
  sort_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'active', 'done', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists itineraries_household_date_idx on public.itineraries (household_id, date_key);
create index if not exists itinerary_stops_itinerary_idx on public.itinerary_stops (itinerary_id, sort_order);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  category text not null,
  base_xp integer not null default 15,
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  weight numeric not null default 1,
  repeat_rule text not null default 'none',
  proof_required boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

alter table public.grocery_items
  add column if not exists barcode text,
  add column if not exists typical_price numeric,
  add column if not exists sale_price numeric,
  add column if not exists aisle text,
  add column if not exists store_id text,
  add column if not exists requested_by text;

alter table public.tasks
  add column if not exists weight numeric,
  add column if not exists difficulty text,
  add column if not exists proof_required boolean default false,
  add column if not exists proof_uri text,
  add column if not exists proof_status text;

alter table public.households
  add column if not exists preferred_store_id text;

alter table public.rewards
  add column if not exists emoji text,
  add column if not exists archived boolean default false,
  add column if not exists special_request boolean default false;

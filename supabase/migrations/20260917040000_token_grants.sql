-- Token top-up grants (Part E). Apply on staging before trusting consumable IAP.
-- Unique transaction_id is the replay guard.

create table if not exists public.token_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pack text not null check (pack in ('small', 'medium', 'large', 'mock')),
  tokens integer not null check (tokens > 0),
  consumed integer not null default 0 check (consumed >= 0),
  transaction_id text not null,
  granted_at timestamptz not null default now(),
  unique (transaction_id)
);

create index if not exists token_grants_household_granted_idx
  on public.token_grants (household_id, granted_at);

alter table public.token_grants enable row level security;

drop policy if exists token_grants_select on public.token_grants;
create policy token_grants_select on public.token_grants for select
  using (public.is_household_member(household_id));

-- Inserts go through service role (grant-token-pack edge) or members for mock path.
drop policy if exists token_grants_insert on public.token_grants;
create policy token_grants_insert on public.token_grants for insert
  with check (public.is_household_member(household_id));

drop policy if exists token_grants_update on public.token_grants;
create policy token_grants_update on public.token_grants for update
  using (public.is_household_member(household_id));

comment on table public.token_grants is
  'Consumable IAP top-ups. transaction_id unique prevents replay. Consume oldest-first after monthly allowance.';

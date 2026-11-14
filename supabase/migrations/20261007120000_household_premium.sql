-- Household Premium: the subscription belongs to the house, not to the phone that paid.
--
-- Until now the entitlement lived only on the purchasing device (StoreKit + AsyncStorage).
-- That was harmless while nothing was gated on it. The payment gate changes that: gated on
-- the local entitlement alone, every Sidekick phone and every shared tablet would read "not
-- paid" forever, because none of them ever bought anything — the admin did, on their own
-- Apple ID, on their own phone.
--
-- So Premium is recorded on the household row. Both hydration paths already read that row
-- (the admin's JWT path through RLS, the Sidekick path through the sidekick-sync edge
-- function), so every device in the house learns the state with no extra plumbing.
--
-- Writes go through the sync-entitlement edge function only. Admins can update their
-- household row for ordinary settings, so a trigger refuses any client change to these
-- columns — otherwise an admin could grant their own house Premium from the console.

alter table public.households
  add column if not exists premium_product_id text,
  add column if not exists premium_in_trial boolean not null default false,
  add column if not exists premium_expires_at timestamptz,
  add column if not exists premium_original_transaction_id text,
  add column if not exists premium_environment text,
  add column if not exists premium_purchased_by uuid references auth.users(id) on delete set null,
  add column if not exists premium_updated_at timestamptz,
  -- Whether Apple says the subscription will renew. A household that has not cancelled keeps
  -- working on the other devices for Apple's full billing grace period past the recorded
  -- expiry, because the renewal only reaches this row when an admin next opens the app.
  add column if not exists premium_will_renew boolean;

-- One Apple subscription unlocks one household. Without this, one person could sync the same
-- receipt into as many households as they can create.
create unique index if not exists households_premium_original_transaction_uidx
  on public.households (premium_original_transaction_id)
  where premium_original_transaction_id is not null;

alter table public.households
  drop constraint if exists households_premium_environment_check;
alter table public.households
  add constraint households_premium_environment_check
  check (premium_environment is null or premium_environment in ('Sandbox', 'Production', 'Xcode'));

-- ── Clients may not write Premium ────────────────────────────────────────────
-- A client is any request carrying a user's JWT, which is exactly when auth.uid() is set. The
-- service role (the sync-entitlement edge function) and the SQL editor carry none.
--
-- This deliberately does NOT test current_user. The function is SECURITY DEFINER, and inside a
-- definer function current_user is the owner — postgres — for every caller, so a check on it
-- passes for everyone and protects nothing. auth.uid() reads the request's JWT claims, which a
-- definer function does not change. Same test as enforce_token_grants_consume_only (v32).
create or replace function public.enforce_household_premium_server_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- A client creating a household starts it with no Premium, whatever it sent. Cleared rather
  -- than refused, so household creation that sends defaults keeps working.
  if tg_op = 'INSERT' then
    new.premium_product_id := null;
    new.premium_in_trial := false;
    new.premium_expires_at := null;
    new.premium_original_transaction_id := null;
    new.premium_environment := null;
    new.premium_purchased_by := null;
    new.premium_updated_at := null;
    new.premium_will_renew := null;
    return new;
  end if;

  if new.premium_product_id is distinct from old.premium_product_id
     or new.premium_in_trial is distinct from old.premium_in_trial
     or new.premium_expires_at is distinct from old.premium_expires_at
     or new.premium_original_transaction_id is distinct from old.premium_original_transaction_id
     or new.premium_environment is distinct from old.premium_environment
     or new.premium_purchased_by is distinct from old.premium_purchased_by
     or new.premium_updated_at is distinct from old.premium_updated_at
     or new.premium_will_renew is distinct from old.premium_will_renew then
    raise exception 'households: Premium is written by the server only.';
  end if;

  return new;
end;
$$;

drop trigger if exists households_premium_server_only on public.households;
create trigger households_premium_server_only
  before insert or update on public.households
  for each row
  execute function public.enforce_household_premium_server_only();

comment on column public.households.premium_expires_at is
  'When the current trial or paid period ends, as last reported by an admin device. Renewals '
  'land when an admin opens the app; App Store Server Notifications should replace that.';

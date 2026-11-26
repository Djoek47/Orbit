-- Fix: start_app_trial never worked. The household premium guard (enforce_household_premium_server_only)
-- refuses any premium change made while a signed-in user's id is set, and a SECURITY DEFINER
-- function still runs with that id. Every call from build 140 failed with a 400.
--
-- Trusted server functions now mark their own transaction with choremaxx.premium_writer=server;
-- clients cannot set that (set_config is not exposed through the API).
--
-- Also: one extra free trial per Apple ID (after Apple's own), then none. The Apple ID is keyed by
-- its subscription's original transaction id.

create or replace function public.enforce_household_premium_server_only()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(current_setting('choremaxx.premium_writer', true), '') = 'server' then
    return new;
  end if;

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
$function$;

-- The same for the permanent "trial used" marks: only a trusted function may set them while a
-- user is signed in. Never cleared, as before.
create or replace function public.keep_trial_used_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_server boolean := coalesce(current_setting('choremaxx.premium_writer', true), '') = 'server';
begin
  if not v_server and auth.uid() is not null and tg_op = 'UPDATE'
     and new.trial_used_at is distinct from old.trial_used_at then
    new.trial_used_at := old.trial_used_at;
  end if;
  if not v_server and auth.uid() is not null and tg_op = 'INSERT' then
    new.trial_used_at := null;
  end if;
  if tg_op = 'UPDATE' and old.trial_used_at is not null then
    new.trial_used_at := least(old.trial_used_at, coalesce(new.trial_used_at, old.trial_used_at));
  end if;
  return new;
end;
$$;

create table if not exists public.app_trial_grants (
  apple_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_trial_grants enable row level security;

create or replace function public.app_trial_used_for(p_apple_key text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from app_trial_grants where apple_key = p_apple_key);
$$;
revoke all on function public.app_trial_used_for(text) from public, anon;
grant execute on function public.app_trial_used_for(text) to authenticated;

create or replace function public.start_app_trial(p_household_id uuid, p_apple_key text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_ends timestamptz := now() + interval '7 days';
  v_house record;
begin
  if v_user is null then raise exception 'not_signed_in'; end if;
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_user and status = 'active'
      and role in ('owner', 'admin')
  ) then raise exception 'forbidden'; end if;
  if exists (select 1 from profiles where id = v_user and trial_used_at is not null) then
    raise exception 'trial_used';
  end if;
  if p_apple_key is not null and exists (select 1 from app_trial_grants where apple_key = p_apple_key) then
    raise exception 'apple_trials_used';
  end if;
  select trial_used_at, premium_expires_at into v_house
  from households where id = p_household_id for update;
  if v_house.trial_used_at is not null then raise exception 'trial_used'; end if;
  if v_house.premium_expires_at is not null and v_house.premium_expires_at > now() then
    raise exception 'already_covered';
  end if;

  perform set_config('choremaxx.premium_writer', 'server', true);
  update households set
    premium_product_id = null, premium_in_trial = true, premium_expires_at = v_ends,
    premium_original_transaction_id = 'app-trial:' || p_household_id::text,
    premium_environment = null, premium_purchased_by = v_user, premium_will_renew = false,
    premium_updated_at = now(), trial_used_at = now()
  where id = p_household_id;
  update profiles set trial_used_at = now() where id = v_user and trial_used_at is null;
  perform set_config('choremaxx.premium_writer', '', true);
  if p_apple_key is not null then
    insert into app_trial_grants (apple_key, user_id, household_id) values (p_apple_key, v_user, p_household_id);
  end if;
  return v_ends;
end;
$$;
revoke all on function public.start_app_trial(uuid, text) from public, anon;
grant execute on function public.start_app_trial(uuid, text) to authenticated;

-- Build 140 calls with the household only.
create or replace function public.start_app_trial(p_household_id uuid)
returns timestamptz language sql security definer set search_path = public as $$
  select public.start_app_trial(p_household_id, null::text);
$$;
revoke all on function public.start_app_trial(uuid) from public, anon;
grant execute on function public.start_app_trial(uuid) to authenticated;

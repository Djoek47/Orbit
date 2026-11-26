-- One extra free trial per Apple ID, not one per account.
--
-- Apple gives each Apple ID one trial. A second Choremaxx account on the same Apple ID gets one
-- more, ours (start_app_trial); after that, every trial for that Apple ID is used. The Apple ID is
-- identified by its subscription's original transaction id (stable per Apple ID per group).
create table if not exists public.app_trial_grants (
  apple_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_trial_grants enable row level security;

create or replace function public.app_trial_used_for(p_apple_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from app_trial_grants where apple_key = p_apple_key);
$$;
revoke all on function public.app_trial_used_for(text) from public, anon;
grant execute on function public.app_trial_used_for(text) to authenticated;

drop function if exists public.start_app_trial(uuid);
create or replace function public.start_app_trial(p_household_id uuid, p_apple_key text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
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
  update households set
    premium_product_id = null,
    premium_in_trial = true,
    premium_expires_at = v_ends,
    premium_original_transaction_id = 'app-trial:' || p_household_id::text,
    premium_environment = null,
    premium_purchased_by = v_user,
    premium_will_renew = false,
    premium_updated_at = now(),
    trial_used_at = now()
  where id = p_household_id;
  update profiles set trial_used_at = now() where id = v_user and trial_used_at is null;
  if p_apple_key is not null then
    insert into app_trial_grants (apple_key, user_id, household_id) values (p_apple_key, v_user, p_household_id);
  end if;
  return v_ends;
end;
$$;
revoke all on function public.start_app_trial(uuid, text) from public, anon;
grant execute on function public.start_app_trial(uuid, text) to authenticated;

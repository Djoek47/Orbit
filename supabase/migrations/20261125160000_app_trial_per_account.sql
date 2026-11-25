-- A free trial per Choremaxx account, granted by us, no payment.
--
-- Apple's introductory offer belongs to the Apple ID: once that Apple ID has had it, a brand-new
-- Choremaxx account on the same phone could only subscribe. The trial follows the account
-- instead. Apple's own trial is still used when the Apple ID can have it (it carries the card);
-- this is the fallback when it cannot.
--
-- Once per person (profiles.trial_used_at) and once per household (households.trial_used_at),
-- both permanent. Only an active owner/admin, only on a household with nothing current.
create or replace function public.start_app_trial(p_household_id uuid)
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
  return v_ends;
end;
$$;

revoke all on function public.start_app_trial(uuid) from public, anon;
grant execute on function public.start_app_trial(uuid) to authenticated;

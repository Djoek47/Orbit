-- Join approval removed — all invite redemptions connect immediately.

create or replace function public.redeem_member_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.member_invite_tokens%rowtype;
  v_member public.household_members%rowtype;
  v_household public.households%rowtype;
  v_admin_count int;
  v_status text;
  v_storage_role text;
  v_user uuid := auth.uid();
  v_other uuid;
begin
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_inv
  from public.member_invite_tokens
  where token = p_token
  for update;

  if not found then
    raise exception 'INVITE_EXPIRED';
  end if;

  perform 1 from public.households where id = v_inv.household_id for update;
  select * into v_household from public.households where id = v_inv.household_id;

  if v_inv.status in ('revoked', 'expired') or v_inv.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_inv.status = 'redeemed' then
    raise exception 'INVITE_USED';
  end if;

  select * into v_member from public.household_members where id = v_inv.member_id;
  if not found then
    raise exception 'INVITE_MEMBER_GONE';
  end if;

  select hm.household_id into v_other
  from public.household_members hm
  where hm.user_id = v_user
    and hm.status in ('active', 'pending')
    and hm.household_id is distinct from v_inv.household_id
  limit 1;
  if v_other is not null then
    raise exception 'INVITE_OTHER_HOUSEHOLD';
  end if;

  if v_member.user_id = v_user then
    return jsonb_build_object(
      'ok', true,
      'alreadyMember', true,
      'role', v_inv.role,
      'memberStatus', 'active',
      'householdId', v_inv.household_id,
      'memberId', v_inv.member_id
    );
  end if;

  if v_inv.role = 'admin' then
    select count(*) into v_admin_count
    from public.household_members
    where household_id = v_inv.household_id
      and status = 'active'
      and role in ('owner', 'admin');
    if v_admin_count >= 2 then
      raise exception 'INVITE_ADMIN_CAP';
    end if;
  end if;

  v_status := 'active';
  v_storage_role := case when v_inv.role = 'sidekick' then 'child' else 'admin' end;

  update public.household_members
  set user_id = v_user,
      role = v_storage_role,
      status = v_status,
      updated_at = now()
  where id = v_inv.member_id;

  update public.member_invite_tokens
  set status = 'redeemed', redeemed_at = now(), updated_at = now()
  where id = v_inv.id;

  return jsonb_build_object(
    'ok', true,
    'alreadyMember', false,
    'role', v_inv.role,
    'memberStatus', v_status,
    'householdId', v_inv.household_id,
    'memberId', v_inv.member_id,
    'householdName', v_household.name,
    'sidekickGroceryAdd', coalesce(v_household.sidekick_grocery_add, false),
    'dailyDeadline', v_household.daily_deadline,
    'rewardModel', v_household.reward_model
  );
end;
$$;

update public.households
set join_approval_required = false
where join_approval_required is distinct from false;

update public.household_members
set status = 'active'
where status = 'pending';

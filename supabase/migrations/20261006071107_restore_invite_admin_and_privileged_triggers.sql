-- Restore generate_member_invite admin gate (rolled back by 20261006062055 dump)
-- and land privileged-field / token_grants consume-only triggers with a safe
-- bypass for SECURITY DEFINER handoff paths (transfer accept + invite redeem).

-- ---------------------------------------------------------------------------
-- 1) Session bypass helpers (local to transaction)
-- ---------------------------------------------------------------------------
create or replace function public.begin_privileged_member_update()
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  perform set_config('orbit.bypass_privileged_member_check', '1', true);
end;
$$;

revoke all on function public.begin_privileged_member_update() from public;
-- Only other SECURITY DEFINER functions call this; not granted to clients.

-- ---------------------------------------------------------------------------
-- 2) Privileged member fields trigger (role / status / user_id / household_id)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_member_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.role is distinct from OLD.role
       or NEW.status is distinct from OLD.status
       or NEW.user_id is distinct from OLD.user_id
       or NEW.household_id is distinct from OLD.household_id then
      if auth.uid() is null then
        return NEW; -- service_role / background
      end if;
      if current_setting('orbit.bypass_privileged_member_check', true) = '1' then
        return NEW; -- accept_household_transfer / redeem_member_invite
      end if;
      if not public.is_household_admin(OLD.household_id) then
        raise exception 'Only household admins can change membership role or status.';
      end if;
      if NEW.role is distinct from OLD.role and NEW.role = 'owner' then
        if not exists (
          select 1 from public.households h
          where h.id = NEW.household_id and h.owner_id = auth.uid()
        ) then
          raise exception 'Only the household owner can assign the owner role.';
        end if;
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists household_members_privileged_fields on public.household_members;
create trigger household_members_privileged_fields
  before update on public.household_members
  for each row
  execute function public.enforce_member_privileged_fields();

-- ---------------------------------------------------------------------------
-- 3) token_grants consume-only (clients may only increase consumed)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_token_grants_consume_only()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if TG_OP = 'UPDATE' and auth.uid() is not null then
    if NEW.household_id is distinct from OLD.household_id
       or NEW.pack is distinct from OLD.pack
       or NEW.tokens is distinct from OLD.tokens
       or NEW.transaction_id is distinct from OLD.transaction_id
       or NEW.granted_at is distinct from OLD.granted_at
       or NEW.consumed < OLD.consumed then
      raise exception 'token_grants: clients may only increase consumed.';
    end if;
  end if;
  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.token_grants') is not null then
    drop policy if exists token_grants_insert on public.token_grants;
    drop trigger if exists token_grants_consume_only on public.token_grants;
    create trigger token_grants_consume_only
      before update on public.token_grants
      for each row
      execute function public.enforce_token_grants_consume_only();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4) generate_member_invite — admin gate + extensions.gen_random_bytes
-- ---------------------------------------------------------------------------
create or replace function public.generate_member_invite(
  p_member_id uuid,
  p_requested_role text
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_household uuid;
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_role text;
  v_token text;
  v_count int;
begin
  if v_caller is null then
    raise exception 'Not authenticated.';
  end if;

  select household_id into v_household
  from public.household_members
  where id = p_member_id;
  if v_household is null then
    raise exception 'Member not found.';
  end if;

  if not public.is_household_admin(v_household) then
    raise exception 'Only household admins can generate member invites.';
  end if;

  perform 1 from public.households where id = v_household for update;

  select owner_id into v_owner from public.households where id = v_household;
  if v_owner is distinct from v_caller then
    v_role := 'sidekick';
  else
    v_role := case when p_requested_role = 'admin' then 'admin' else 'sidekick' end;
  end if;

  if v_role = 'admin' then
    select count(*) into v_count
    from public.household_members
    where household_id = v_household
      and status = 'active'
      and role in ('owner', 'admin');
    if v_count >= 2 then
      raise exception 'Only two admins per household. Demote an existing admin first.';
    end if;
  end if;

  update public.member_invite_tokens
  set status = 'revoked', updated_at = now()
  where member_id = p_member_id
    and status = 'active';

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.member_invite_tokens (
    token, household_id, member_id, role, status, created_by, expires_at
  ) values (
    v_token, v_household, p_member_id, v_role, 'active', v_caller, now() + interval '7 days'
  );

  return jsonb_build_object('ok', true, 'token', v_token, 'role', v_role);
end;
$$;

revoke all on function public.generate_member_invite(uuid, text) from public;
revoke all on function public.generate_member_invite(uuid, text) from anon;
grant execute on function public.generate_member_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Patch accept_household_transfer + redeem_member_invite with bypass
-- ---------------------------------------------------------------------------
create or replace function public.accept_household_transfer(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_row public.household_transfer_tokens%rowtype;
  v_uid uuid := auth.uid();
  v_source uuid;
  v_member_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'TRANSFER_INVALID';
  end if;

  select * into v_row
  from public.household_transfer_tokens
  where token = trim(p_token)
  for update;

  if not found then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;

  if v_row.status = 'redeemed' then
    raise exception 'TRANSFER_USED';
  end if;

  if v_row.status <> 'active' or v_row.expires_at < now() then
    update public.household_transfer_tokens
    set status = 'expired'
    where id = v_row.id and status = 'active';
    raise exception 'TRANSFER_EXPIRED';
  end if;

  if v_row.created_by = v_uid then
    raise exception 'TRANSFER_SELF';
  end if;

  if not public.account_eligible_for_household_transfer(v_uid) then
    raise exception 'TRANSFER_NOT_EMPTY';
  end if;

  select owner_id, name into v_source, v_name
  from public.households
  where id = v_row.household_id
  for update;

  if v_source is null then
    raise exception 'TRANSFER_NOT_FOUND';
  end if;

  if v_source <> v_row.created_by then
    raise exception 'TRANSFER_OWNER_CHANGED';
  end if;

  perform public.begin_privileged_member_update();

  update public.households
  set
    owner_id = v_uid,
    deletion_scheduled_for = null,
    deletion_requested_by = null,
    deleted_at = null,
    deletion_reminder_stage = null,
    deletion_reminders_opt_out = false,
    deletion_immediate_token = null,
    deletion_immediate_token_expires_at = null,
    updated_at = now()
  where id = v_row.household_id;

  update public.household_members
  set role = 'adult', updated_at = now()
  where household_id = v_row.household_id
    and user_id = v_source
    and status = 'active'
    and role in ('owner', 'admin');

  select id into v_member_id
  from public.household_members
  where household_id = v_row.household_id
    and user_id = v_uid
  limit 1;

  if v_member_id is null then
    insert into public.household_members (
      household_id, user_id, display_name, role, status
    )
    select
      v_row.household_id,
      v_uid,
      coalesce(p.display_name, split_part(p.email, '@', 1), 'Owner'),
      'owner',
      'active'
    from public.profiles p
    where p.id = v_uid
    returning id into v_member_id;
  else
    update public.household_members
    set role = 'owner', status = 'active', updated_at = now()
    where id = v_member_id;
  end if;

  update public.household_transfer_tokens
  set
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = v_uid
  where id = v_row.id;

  update public.household_transfer_tokens
  set status = 'revoked'
  where household_id = v_row.household_id
    and status = 'active'
    and id <> v_row.id;

  return jsonb_build_object(
    'ok', true,
    'householdId', v_row.household_id,
    'householdName', coalesce(v_name, 'Household'),
    'memberId', v_member_id,
    'role', 'owner'
  );
end;
$$;

create or replace function public.redeem_member_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to public
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
      'memberStatus', case when v_inv.role = 'sidekick' then 'active' else coalesce(v_member.status, 'pending') end,
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

  v_status := case when v_inv.role = 'sidekick' then 'active' else 'pending' end;
  v_storage_role := case when v_inv.role = 'sidekick' then 'child' else 'admin' end;

  perform public.begin_privileged_member_update();

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

revoke all on function public.accept_household_transfer(text) from public;
revoke all on function public.accept_household_transfer(text) from anon;
grant execute on function public.accept_household_transfer(text) to authenticated;

revoke all on function public.redeem_member_invite(text) from public;
revoke all on function public.redeem_member_invite(text) from anon;
grant execute on function public.redeem_member_invite(text) to authenticated;

revoke all on function public.enforce_member_privileged_fields() from public;
revoke all on function public.enforce_member_privileged_fields() from anon;
revoke all on function public.enforce_member_privileged_fields() from authenticated;

revoke all on function public.enforce_token_grants_consume_only() from public;
revoke all on function public.enforce_token_grants_consume_only() from anon;
revoke all on function public.enforce_token_grants_consume_only() from authenticated;

-- Pass A+F: fix transfer QR gen_random_bytes (pgcrypto lives in extensions),
-- lock mutable search_path on trigger/helper functions, revoke anon EXECUTE on
-- SECURITY DEFINER RPCs, and give monitor_cron_cursor a service_role policy.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) Token minting: qualify extensions.gen_random_bytes under search_path=public
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_household_transfer_token(p_household_id uuid)
 RETURNS TABLE(token text, expires_at timestamp with time zone, household_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
declare
  v_token text;
  v_expires timestamptz;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.households h
    where h.id = p_household_id
      and h.owner_id = auth.uid()
      and h.deleted_at is null
  ) then
    raise exception 'Only the household owner can transfer ownership';
  end if;

  update public.household_transfer_tokens
  set status = 'revoked'
  where household_id = p_household_id
    and status = 'active';

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + interval '15 minutes';

  insert into public.household_transfer_tokens (
    token, household_id, created_by, status, expires_at
  ) values (
    v_token, p_household_id, auth.uid(), 'active', v_expires
  );

  select h.name into v_name from public.households h where h.id = p_household_id;

  token := v_token;
  expires_at := v_expires;
  household_name := coalesce(v_name, 'Household');
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_immediate_household_deletion(p_household_id uuid)
 RETURNS TABLE(scheduled_for timestamp with time zone, confirm_token text, confirm_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
declare
  v_scheduled timestamptz;
  v_token text;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_admin(p_household_id) then
    raise exception 'Only a household owner or admin can accelerate deletion';
  end if;

  if not exists (
    select 1 from public.households h
    where h.id = p_household_id
      and h.deletion_scheduled_for is not null
      and h.deleted_at is null
  ) then
    raise exception 'Household is not scheduled for deletion';
  end if;

  v_scheduled := now() + interval '24 hours';
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := v_scheduled;

  update public.households
  set
    deletion_scheduled_for = v_scheduled,
    deletion_requested_by = auth.uid(),
    deletion_reminder_stage = null,
    deletion_immediate_token = v_token,
    deletion_immediate_token_expires_at = v_expires,
    updated_at = now()
  where id = p_household_id;

  scheduled_for := v_scheduled;
  confirm_token := v_token;
  confirm_expires_at := v_expires;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_member_invite(p_member_id uuid, p_requested_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
declare
  v_household uuid;
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_role text;
  v_token text;
  v_count int;
begin
  select household_id into v_household
  from public.household_members
  where id = p_member_id;
  if v_household is null then
    raise exception 'Member not found.';
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
$function$;

-- ---------------------------------------------------------------------------
-- 2) Mutable search_path → lock to public (advisor 0011)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_admin_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO public
AS $function$
declare
  n int;
  v_demote text;
begin
  if new.role not in ('owner', 'admin') then
    return new;
  end if;
  if new.status is distinct from 'active' then
    return new;
  end if;
  perform 1 from public.households where id = new.household_id for update;
  select count(*) into n
  from public.household_members
  where household_id = new.household_id
    and status = 'active'
    and role in ('owner', 'admin')
    and id is distinct from new.id;
  if n >= 2 then
    select display_name into v_demote
    from public.household_members
    where household_id = new.household_id
      and status = 'active'
      and role = 'admin'
      and id is distinct from new.id
    limit 1;
    raise exception 'Only two admins per household. Demote % first.', coalesce(v_demote, 'the other admin');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.tasks_fill_completion_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO public
AS $function$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
    if new.awarded_xp is null then
      new.awarded_xp := coalesce(new.xp_value, 0);
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.storage_proof_household_id(object_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO public
AS $function$
declare
  part text := split_part(object_name, '/', 1);
begin
  if part is null or part !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return part::uuid;
exception
  when others then
    return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.storage_avatar_household_id(object_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO public
AS $function$
declare
  part text := split_part(object_name, '/', 1);
begin
  if part is null or part !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return part::uuid;
exception
  when others then
    return null;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3) Revoke anon EXECUTE on SECURITY DEFINER functions (advisor 0028)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'accept_household_transfer',
        'account_eligible_for_household_transfer',
        'activity_log_on_notification_delete',
        'activity_log_on_notification_insert',
        'activity_log_on_notification_update',
        'cancel_household_deletion',
        'confirm_immediate_household_deletion',
        'create_household_transfer_token',
        'decide_reward_proposal',
        'delete_own_account',
        'generate_member_invite',
        'handle_new_user',
        'household_role',
        'is_household_admin',
        'is_household_member',
        'opt_out_household_deletion_reminders',
        'promote_member_to_admin',
        'redeem_member_invite',
        'request_household_deletion',
        'request_immediate_household_deletion',
        'submit_account_deletion_feedback',
        'submit_reward_proposal'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'activity_log_on_notification_delete',
        'activity_log_on_notification_insert',
        'activity_log_on_notification_update',
        'handle_new_user',
        'set_updated_at',
        'enforce_admin_cap',
        'tasks_fill_completion_snapshot'
      )
  loop
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    execute format('revoke all on function %s from authenticated', r.sig);
  end loop;
end $$;

grant execute on function public.create_household_transfer_token(uuid) to authenticated;
grant execute on function public.accept_household_transfer(text) to authenticated;
grant execute on function public.account_eligible_for_household_transfer(uuid) to authenticated;
grant execute on function public.request_immediate_household_deletion(uuid) to authenticated;
grant execute on function public.generate_member_invite(uuid, text) to authenticated;
grant execute on function public.cancel_household_deletion(uuid) to authenticated;
grant execute on function public.confirm_immediate_household_deletion(text) to authenticated;
grant execute on function public.request_household_deletion(uuid) to authenticated;
grant execute on function public.opt_out_household_deletion_reminders(uuid) to authenticated;
grant execute on function public.decide_reward_proposal(uuid, boolean) to authenticated;
grant execute on function public.submit_reward_proposal(text, text) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.submit_account_deletion_feedback(text, text) to authenticated;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;
grant execute on function public.redeem_member_invite(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.household_role(uuid) to authenticated;
grant execute on function public.storage_proof_household_id(text) to authenticated, anon, service_role;
grant execute on function public.storage_avatar_household_id(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 4) monitor_cron_cursor — RLS on, no policy (advisor 0008)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.monitor_cron_cursor') is not null then
    execute 'alter table public.monitor_cron_cursor enable row level security';
    execute 'drop policy if exists monitor_cron_cursor_service on public.monitor_cron_cursor';
    execute $pol$
      create policy monitor_cron_cursor_service on public.monitor_cron_cursor
        for all
        to service_role
        using (true)
        with check (true)
    $pol$;
    execute 'revoke all on table public.monitor_cron_cursor from anon, authenticated';
    execute 'grant all on table public.monitor_cron_cursor to service_role';
  end if;
end $$;

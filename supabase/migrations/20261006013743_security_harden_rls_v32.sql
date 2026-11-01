-- make-v32 CRITICAL RLS hardening
-- Closes: world-readable invites, open members_insert, role escalation,
-- client token_grants INSERT, ungated generate_member_invite, tables missing RLS.
-- Join / grant paths that need elevated access use service-role edge functions.

-- ---------------------------------------------------------------------------
-- 1) household_invites: members-only SELECT (join-household uses service role)
-- ---------------------------------------------------------------------------
drop policy if exists invites_select on public.household_invites;
create policy invites_select on public.household_invites for select
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- 2) household_members INSERT: admin, or bootstrap owner on own household
-- ---------------------------------------------------------------------------
drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members for insert
  with check (
    public.is_household_admin(household_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1
        from public.households h
        where h.id = household_id
          and h.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Role / status lock — members may update own XP/profile fields; admins only
--    may change role, status, user_id, or household_id.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_member_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.role is distinct from OLD.role
       or NEW.status is distinct from OLD.status
       or NEW.user_id is distinct from OLD.user_id
       or NEW.household_id is distinct from OLD.household_id then
      if auth.uid() is null then
        -- service_role / background jobs (no JWT) may update
        return NEW;
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
-- 4) token_grants: no client INSERT; consume-only client UPDATE
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.token_grants') is not null then
    drop policy if exists token_grants_insert on public.token_grants;
  end if;
end $$;
-- Inserts only via service role (grant-token-pack edge). No authenticated INSERT policy.

create or replace function public.enforce_token_grants_consume_only()
returns trigger
language plpgsql
security definer
set search_path = public
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
    drop trigger if exists token_grants_consume_only on public.token_grants;
    create trigger token_grants_consume_only
      before update on public.token_grants
      for each row
      execute function public.enforce_token_grants_consume_only();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) generate_member_invite: require household admin
-- ---------------------------------------------------------------------------
create or replace function public.generate_member_invite(
  p_member_id uuid,
  p_requested_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
grant execute on function public.generate_member_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Enable RLS on previously unprotected household tables (skip if absent)
-- Staging may not have Revision D / family-time tables yet. Never hard-fail.
-- ---------------------------------------------------------------------------
do $$
begin
  -- itineraries
  if to_regclass('public.itineraries') is not null then
    alter table public.itineraries enable row level security;
    drop policy if exists itineraries_all on public.itineraries;
    create policy itineraries_all on public.itineraries for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- itinerary_stops (via parent itinerary)
  if to_regclass('public.itinerary_stops') is not null then
    alter table public.itinerary_stops enable row level security;
    drop policy if exists itinerary_stops_all on public.itinerary_stops;
    create policy itinerary_stops_all on public.itinerary_stops for all
      using (
        exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id
            and public.is_household_member(i.household_id)
        )
      )
      with check (
        exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id
            and public.is_household_member(i.household_id)
        )
      );
  end if;

  -- task_templates
  if to_regclass('public.task_templates') is not null then
    alter table public.task_templates enable row level security;
    drop policy if exists task_templates_all on public.task_templates;
    create policy task_templates_all on public.task_templates for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- xp_ledger_entries (Revision D — often missing on staging)
  if to_regclass('public.xp_ledger_entries') is not null then
    alter table public.xp_ledger_entries enable row level security;
    drop policy if exists xp_ledger_all on public.xp_ledger_entries;
    create policy xp_ledger_all on public.xp_ledger_entries for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- streak_rescues
  if to_regclass('public.streak_rescues') is not null then
    alter table public.streak_rescues enable row level security;
    drop policy if exists streak_rescues_all on public.streak_rescues;
    create policy streak_rescues_all on public.streak_rescues for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- day_classifications
  if to_regclass('public.day_classifications') is not null then
    alter table public.day_classifications enable row level security;
    drop policy if exists day_classifications_all on public.day_classifications;
    create policy day_classifications_all on public.day_classifications for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- recess_periods
  if to_regclass('public.recess_periods') is not null then
    alter table public.recess_periods enable row level security;
    drop policy if exists recess_periods_all on public.recess_periods;
    create policy recess_periods_all on public.recess_periods for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- crown_awards
  if to_regclass('public.crown_awards') is not null then
    alter table public.crown_awards enable row level security;
    drop policy if exists crown_awards_all on public.crown_awards;
    create policy crown_awards_all on public.crown_awards for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  -- monitor_cron_cursor: service-role only (no authenticated policies)
  if to_regclass('public.monitor_cron_cursor') is not null then
    alter table public.monitor_cron_cursor enable row level security;
    comment on table public.monitor_cron_cursor is
      'Single-row cursor for poppins-monitor cron; RLS on, no client policies (service_role only).';
  end if;
end $$;

-- Household ownership transfer via QR (TTL 15 minutes).
-- Destination must be an empty account or only recoverable scheduled-delete shells.
-- Post-transfer: source demoted (cannot recover); destination becomes sole owner.

create table if not exists public.household_transfer_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'redeemed', 'revoked', 'expired')),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists household_transfer_tokens_household_idx
  on public.household_transfer_tokens (household_id, status);

create index if not exists household_transfer_tokens_expires_idx
  on public.household_transfer_tokens (expires_at)
  where status = 'active';

alter table public.household_transfer_tokens enable row level security;

drop policy if exists household_transfer_tokens_owner_select on public.household_transfer_tokens;
create policy household_transfer_tokens_owner_select on public.household_transfer_tokens
  for select using (
    created_by = auth.uid()
    or public.is_household_admin(household_id)
  );

comment on table public.household_transfer_tokens is
  'One-time QR tokens to transfer household ownership to an empty/new account (15m TTL).';

-- True when user has no healthy active household — only empty or recoverable shells.
create or replace function public.account_eligible_for_household_transfer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.household_members hm
    join public.households h on h.id = hm.household_id
    where hm.user_id = p_user_id
      and hm.status in ('active', 'pending')
      and h.deleted_at is null
      and (
        h.deletion_scheduled_for is null
        or h.deletion_scheduled_for <= now()
      )
  );
$$;

revoke all on function public.account_eligible_for_household_transfer(uuid) from public;
grant execute on function public.account_eligible_for_household_transfer(uuid) to authenticated;

create or replace function public.create_household_transfer_token(p_household_id uuid)
returns table (
  token text,
  expires_at timestamptz,
  household_name text
)
language plpgsql
security definer
set search_path = public
as $$
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

  -- Revoke prior active tokens for this household
  update public.household_transfer_tokens
  set status = 'revoked'
  where household_id = p_household_id
    and status = 'active';

  v_token := encode(gen_random_bytes(24), 'hex');
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
$$;

create or replace function public.accept_household_transfer(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  -- Destination becomes owner; clear any pending deletion (clean handoff).
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

  -- Burn source recovery: demote previous owner to adult (no recovery rights).
  update public.household_members
  set role = 'adult', updated_at = now()
  where household_id = v_row.household_id
    and user_id = v_source
    and status = 'active'
    and role in ('owner', 'admin');

  -- Upsert destination as owner member
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

  -- Revoke any other active transfer tokens for this household
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

revoke all on function public.create_household_transfer_token(uuid) from public;
revoke all on function public.accept_household_transfer(text) from public;
grant execute on function public.create_household_transfer_token(uuid) to authenticated;
grant execute on function public.accept_household_transfer(text) to authenticated;

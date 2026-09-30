-- Revision G: member invite tokens, two-admin cap, sidekick grocery flag, proposals.

alter table public.households
  add column if not exists sidekick_grocery_add boolean not null default false;

-- TODO(product): What happens to the household if the Owner leaves or the subscription
-- lapses? Default shipped: nothing auto-promotes.

alter table public.grocery_items
  add column if not exists requested_by text;

alter table public.rewards
  add column if not exists assigned_member_id uuid references public.household_members(id) on delete set null;

create table if not exists public.member_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  role text not null check (role in ('admin', 'sidekick')),
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked', 'expired')),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_invite_tokens_member_idx
  on public.member_invite_tokens (member_id, status);

create table if not exists public.reward_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  title text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create index if not exists reward_proposals_member_idx
  on public.reward_proposals (member_id, status, created_at desc);

-- Lock the household row before counting so two concurrent promotions cannot
-- both see one open seat (Revision G A2.5).
create or replace function public.enforce_admin_cap()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists household_members_admin_cap on public.household_members;
create trigger household_members_admin_cap
  before insert or update of role, status on public.household_members
  for each row execute function public.enforce_admin_cap();

create or replace function public.promote_member_to_admin(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_count int;
  v_demote text;
  v_target_role text;
begin
  select household_id, role into v_household, v_target_role
  from public.household_members
  where id = p_member_id;
  if v_household is null then
    raise exception 'Member not found.';
  end if;

  perform 1 from public.households where id = v_household for update;

  select owner_id into v_owner from public.households where id = v_household;
  if v_owner is distinct from v_caller then
    raise exception 'Only the owner can promote an admin.';
  end if;

  if v_target_role in ('owner', 'admin') then
    return jsonb_build_object('ok', true);
  end if;

  select count(*) into v_count
  from public.household_members
  where household_id = v_household
    and status = 'active'
    and role in ('owner', 'admin');

  if v_count >= 2 then
    select display_name into v_demote
    from public.household_members
    where household_id = v_household
      and status = 'active'
      and role = 'admin'
    limit 1;
    raise exception 'Only two admins per household. Demote % first.', coalesce(v_demote, 'the other admin');
  end if;

  update public.household_members
  set role = 'admin'
  where id = p_member_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.promote_member_to_admin(uuid) from public;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;

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

  v_token := encode(gen_random_bytes(16), 'hex');

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

drop policy if exists groceries_all on public.grocery_items;

create policy groceries_select on public.grocery_items
  for select using (public.is_household_member(household_id));

create policy groceries_insert on public.grocery_items
  for insert with check (
    public.is_household_admin(household_id)
    or (
      public.household_role(household_id) is distinct from 'child'
      and public.is_household_member(household_id)
    )
    or (
      public.household_role(household_id) = 'child'
      and exists (
        select 1 from public.households h
        where h.id = household_id and h.sidekick_grocery_add = true
      )
    )
  );

create policy groceries_update on public.grocery_items
  for update using (
    public.is_household_admin(household_id)
    or (
      public.is_household_member(household_id)
      and public.household_role(household_id) is distinct from 'child'
    )
  );

create policy groceries_delete on public.grocery_items
  for delete using (
    public.is_household_admin(household_id)
    or (
      public.is_household_member(household_id)
      and public.household_role(household_id) is distinct from 'child'
    )
  );

alter table public.reward_proposals enable row level security;
drop policy if exists reward_proposals_select on public.reward_proposals;
create policy reward_proposals_select on public.reward_proposals
  for select using (
    public.is_household_admin(household_id)
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = reward_proposals.household_id
        and hm.user_id = auth.uid()
        and hm.id = reward_proposals.member_id
    )
  );
drop policy if exists reward_proposals_insert on public.reward_proposals;
create policy reward_proposals_insert on public.reward_proposals
  for insert with check (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = reward_proposals.household_id
        and hm.user_id = auth.uid()
        and hm.id = reward_proposals.member_id
        and hm.status = 'active'
    )
  );
drop policy if exists reward_proposals_update on public.reward_proposals;
create policy reward_proposals_update on public.reward_proposals
  for update using (public.is_household_admin(household_id));

alter table public.member_invite_tokens enable row level security;
drop policy if exists member_invite_tokens_admin on public.member_invite_tokens;
create policy member_invite_tokens_admin on public.member_invite_tokens
  for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

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

revoke all on function public.redeem_member_invite(text) from public;
grant execute on function public.redeem_member_invite(text) to authenticated;

create or replace function public.submit_reward_proposal(p_title text, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_member public.household_members%rowtype;
  v_open int;
  v_last timestamptz;
begin
  select * into v_member
  from public.household_members
  where user_id = v_user and status = 'active'
  order by created_at desc
  limit 1;
  if v_member.id is null then
    raise exception 'Not a household member.';
  end if;
  if v_member.role is distinct from 'child' then
    raise exception 'Only a sidekick can propose a reward.';
  end if;

  select count(*) into v_open
  from public.reward_proposals
  where member_id = v_member.id and status = 'open';
  if v_open > 0 then
    raise exception 'OPEN_PROPOSAL';
  end if;

  -- TODO(product): Is a seven-day proposal cooldown the right cadence? Default shipped: seven days.
  select max(created_at) into v_last
  from public.reward_proposals
  where member_id = v_member.id;
  if v_last is not null and v_last > now() - interval '7 days' then
    raise exception 'PROPOSAL_COOLDOWN';
  end if;

  insert into public.reward_proposals (household_id, member_id, title, note)
  values (v_member.household_id, v_member.id, trim(p_title), nullif(trim(coalesce(p_note, '')), ''));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_reward_proposal(text, text) from public;
grant execute on function public.submit_reward_proposal(text, text) to authenticated;

create or replace function public.decide_reward_proposal(p_proposal_id uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_prop public.reward_proposals%rowtype;
  v_reward_id uuid;
begin
  select * into v_prop from public.reward_proposals where id = p_proposal_id;
  if v_prop.id is null then
    raise exception 'Proposal not found.';
  end if;
  if not public.is_household_admin(v_prop.household_id) then
    raise exception 'Only an admin can decide a proposal.';
  end if;
  if v_prop.status is distinct from 'open' then
    return jsonb_build_object('ok', true, 'status', v_prop.status);
  end if;

  update public.reward_proposals
  set status = case when p_approve then 'approved' else 'declined' end,
      decided_at = now(),
      decided_by = v_user
  where id = p_proposal_id;

  if p_approve then
    insert into public.rewards (household_id, title, cost, approval_required, assigned_member_id)
    values (v_prop.household_id, v_prop.title, 0, true, v_prop.member_id)
    returning id into v_reward_id;
  end if;

  return jsonb_build_object('ok', true, 'rewardId', v_reward_id);
end;
$$;

revoke all on function public.decide_reward_proposal(uuid, boolean) from public;
grant execute on function public.decide_reward_proposal(uuid, boolean) to authenticated;

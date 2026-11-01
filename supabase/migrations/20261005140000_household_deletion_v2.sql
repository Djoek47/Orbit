-- Household deletion v2 — 30-day grace (B), admin/owner RPCs, reminder stages,
-- immediate confirm token, reminder opt-out.

alter table public.households
  add column if not exists deletion_reminder_stage text
    check (
      deletion_reminder_stage is null
      or deletion_reminder_stage in ('7d', '3d', '24h', '1h11m')
    ),
  add column if not exists deletion_reminders_opt_out boolean not null default false,
  add column if not exists deletion_immediate_token text,
  add column if not exists deletion_immediate_token_expires_at timestamptz;

create unique index if not exists households_deletion_immediate_token_uidx
  on public.households (deletion_immediate_token)
  where deletion_immediate_token is not null;

comment on column public.households.deletion_scheduled_for is
  'Purge instant — permanent deletion runs at or after this timestamp (30-day grace by default).';
comment on column public.households.deletion_reminder_stage is
  'Last deletion reminder stage emailed (7d/3d/24h/1h11m).';

-- Owner or admin (is_household_admin covers both).
create or replace function public.request_household_deletion(p_household_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scheduled timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_admin(p_household_id) then
    raise exception 'Only a household owner or admin can delete this household';
  end if;

  v_scheduled := now() + interval '30 days';

  update public.households
  set
    deletion_scheduled_for = v_scheduled,
    deletion_requested_by = auth.uid(),
    deleted_at = null,
    deletion_reminder_stage = null,
    deletion_reminders_opt_out = false,
    deletion_immediate_token = null,
    deletion_immediate_token_expires_at = null,
    updated_at = now()
  where id = p_household_id;

  return v_scheduled;
end;
$$;

create or replace function public.cancel_household_deletion(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_admin(p_household_id) then
    raise exception 'Only a household owner or admin can cancel deletion';
  end if;

  update public.households
  set
    deletion_scheduled_for = null,
    deletion_requested_by = null,
    deleted_at = null,
    deletion_reminder_stage = null,
    deletion_reminders_opt_out = false,
    deletion_immediate_token = null,
    deletion_immediate_token_expires_at = null,
    updated_at = now()
  where id = p_household_id;
end;
$$;

-- Accelerate to a 24h confirm window + one-time token for email CTA.
create or replace function public.request_immediate_household_deletion(p_household_id uuid)
returns table (
  scheduled_for timestamptz,
  confirm_token text,
  confirm_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.confirm_immediate_household_deletion(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) < 16 then
    raise exception 'Invalid confirmation token';
  end if;

  select h.id into v_id
  from public.households h
  where h.deletion_immediate_token = trim(p_token)
    and h.deletion_immediate_token_expires_at is not null
    and h.deletion_immediate_token_expires_at >= now()
    and h.deleted_at is null
    and public.is_household_admin(h.id);

  if v_id is null then
    raise exception 'Confirmation token expired or not found';
  end if;

  update public.households
  set
    deleted_at = now(),
    deletion_scheduled_for = now(),
    deletion_immediate_token = null,
    deletion_immediate_token_expires_at = null,
    updated_at = now()
  where id = v_id;

  return v_id;
end;
$$;

create or replace function public.opt_out_household_deletion_reminders(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_household_admin(p_household_id) then
    raise exception 'Only a household owner or admin can change reminder preferences';
  end if;

  update public.households
  set
    deletion_reminders_opt_out = true,
    updated_at = now()
  where id = p_household_id
    and deletion_scheduled_for is not null;
end;
$$;

-- Soft-mark households past purge instant (data wipe is a later ops step).
create or replace function public.purge_due_households()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.households
  set
    deleted_at = coalesce(deleted_at, now()),
    deletion_immediate_token = null,
    deletion_immediate_token_expires_at = null,
    updated_at = now()
  where deletion_scheduled_for is not null
    and deletion_scheduled_for <= now()
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.purge_due_households() is
  'Marks households with deletion_scheduled_for <= now() as deleted_at. Cron / service_role only.';

revoke all on function public.purge_due_households() from public;
revoke all on function public.purge_due_households() from anon;
revoke all on function public.purge_due_households() from authenticated;

grant execute on function public.request_household_deletion(uuid) to authenticated;
grant execute on function public.cancel_household_deletion(uuid) to authenticated;
grant execute on function public.request_immediate_household_deletion(uuid) to authenticated;
grant execute on function public.confirm_immediate_household_deletion(text) to authenticated;
grant execute on function public.opt_out_household_deletion_reminders(uuid) to authenticated;

-- Hourly purge + edge reminder cron docs (edge is invoked via pg_net when configured).
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron extension not available: %', sqlerrm;
end $$;

do $$
begin
  perform cron.unschedule('purge-due-households');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule(
    'purge-due-households',
    '15 * * * *',
    $cron$select public.purge_due_households();$cron$
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;

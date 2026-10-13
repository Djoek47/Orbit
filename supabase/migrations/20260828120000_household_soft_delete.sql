-- Household soft delete — 15-day grace before permanent purge.

alter table public.households
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid references public.profiles(id) on delete set null;

create index if not exists households_deletion_scheduled_idx
  on public.households (deletion_scheduled_for)
  where deletion_scheduled_for is not null;

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

  if not exists (
    select 1 from public.households h
    where h.id = p_household_id and h.owner_id = auth.uid()
  ) then
    raise exception 'Only the household owner can delete this household';
  end if;

  v_scheduled := now() + interval '15 days';

  update public.households
  set
    deletion_scheduled_for = v_scheduled,
    deletion_requested_by = auth.uid(),
    deleted_at = null,
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

  if not exists (
    select 1 from public.households h
    where h.id = p_household_id and h.owner_id = auth.uid()
  ) then
    raise exception 'Only the household owner can cancel deletion';
  end if;

  update public.households
  set
    deletion_scheduled_for = null,
    deletion_requested_by = null,
    deleted_at = null,
    updated_at = now()
  where id = p_household_id;
end;
$$;

grant execute on function public.request_household_deletion(uuid) to authenticated;
grant execute on function public.cancel_household_deletion(uuid) to authenticated;

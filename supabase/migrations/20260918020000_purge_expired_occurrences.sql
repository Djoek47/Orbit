-- Expired occurrence auto-delete after 7 days (CURSOR-SPEC-expired-purge).
-- Occurrences live in public.tasks (status expired/missed). Templates are never purged.

-- 1) Ensure expired_at + index (column may already exist from Rev F)
alter table public.tasks
  add column if not exists expired_at timestamptz;

create index if not exists tasks_expired_at_idx
  on public.tasks (expired_at)
  where status in ('expired', 'missed') and expired_at is not null;

-- 2) Backfill missing stamps from occurrence day at 23:59:59 (UTC stand-in for
--    household-local 11:59 PM when timezone is unavailable at SQL time).
update public.tasks
set expired_at = coalesce(
  expired_at,
  case
    when occurrence_date is not null then
      ((occurrence_date::timestamp + time '23:59:59') at time zone 'UTC')
    when due_at is not null then due_at
    else updated_at
  end
)
where status in ('expired', 'missed')
  and expired_at is null;

-- 3) Purge function — security definer; not callable by clients
create or replace function public.purge_expired_occurrences()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_paths text[];
  v_deleted integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[])
  into v_ids
  from public.tasks
  where status in ('expired', 'missed')
    and expired_at is not null
    and expired_at <= (now() - interval '7 days');

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return 0;
  end if;

  -- Storage paths from task_proofs (CASCADE would drop rows; collect first)
  select coalesce(array_agg(distinct storage_path), '{}'::text[])
  into v_paths
  from public.task_proofs
  where task_id = any (v_ids)
    and storage_path is not null
    and length(trim(storage_path)) > 0;

  -- Notifications keyed by task id in jsonb data (no FK)
  delete from public.notifications n
  using unnest(v_ids) as purged(id)
  where n.data ->> 'taskId' = purged.id::text;

  -- Proof photo files in Storage (best-effort across buckets by object name)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) and coalesce(array_length(v_paths, 1), 0) > 0 then
    delete from storage.objects
    where name = any (v_paths);
  end if;

  -- Deleting tasks cascades task_proofs / task_checklists / task_assignments;
  -- xp_transactions.related_task_id becomes null (ON DELETE SET NULL).
  delete from public.tasks
  where id = any (v_ids);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.purge_expired_occurrences() is
  'Deletes expired/missed task occurrences older than 7 days plus dependents and storage objects. Never templates or completed rows.';

revoke all on function public.purge_expired_occurrences() from public;
revoke all on function public.purge_expired_occurrences() from anon;
revoke all on function public.purge_expired_occurrences() from authenticated;
-- service_role / postgres retain execute for cron

-- 4) pg_cron hourly (best-effort — skip if extension unavailable in this project)
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then
    raise notice 'pg_cron extension not available: %', sqlerrm;
end $$;

do $$
begin
  perform cron.unschedule('purge-expired-occurrences');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule(
    'purge-expired-occurrences',
    '0 * * * *',
    $cron$select public.purge_expired_occurrences();$cron$
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;

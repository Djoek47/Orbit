-- Revision F §1 — strengthen occurrence uniqueness, expired status, cleanup dupes.

-- Status + expired_at for rollover (Rev F §5.2).
alter table if exists public.tasks
  add column if not exists expired_at timestamptz;

-- Extend status check to include expired / cancelled / missed (legacy missed → overdue map).
do $$
begin
  alter table public.tasks drop constraint if exists tasks_status_check;
exception
  when undefined_object then null;
end $$;

alter table public.tasks
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in (
    'pending',
    'in_progress',
    'completed',
    'overdue',
    'cancelled',
    'expired',
    'missed'
  ));

-- Ensure unique index exists (idempotent with prior migration).
create unique index if not exists tasks_definition_occurrence_uidx
  on public.tasks (household_id, definition_id, occurrence_date)
  where definition_id is not null and occurrence_date is not null;

-- Cleanup: keep one row per (household_id, definition_id, occurrence_date).
-- Prefer completed; else earliest created_at.
with ranked as (
  select
    id,
    awarded_xp,
    status,
    row_number() over (
      partition by household_id, definition_id, occurrence_date
      order by
        case when status = 'completed' then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as rn
  from public.tasks
  where definition_id is not null
    and occurrence_date is not null
),
dupes as (
  select id, awarded_xp, status
  from ranked
  where rn > 1
),
xp_sum as (
  select coalesce(sum(awarded_xp), 0)::int as xp_reconciled, count(*)::int as deleted_count
  from dupes
  where status = 'completed'
)
delete from public.tasks t
using dupes d
where t.id = d.id;

-- Report via notice (apply in CI / ops logs).
do $$
declare
  remaining_dupes int;
begin
  select count(*) into remaining_dupes
  from (
    select household_id, definition_id, occurrence_date
    from public.tasks
    where definition_id is not null and occurrence_date is not null
    group by 1, 2, 3
    having count(*) > 1
  ) x;
  raise notice 'revision_f_occurrence_cleanup: remaining_duplicate_groups=%', remaining_dupes;
end $$;

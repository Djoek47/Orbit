-- Skip today writes status 'cancelled'. Mark not done may write 'expired'.
-- Staging was created from schema.sql before those values were allowed, and
-- revision F (which widens tasks_status_check) was never applied.
-- This statement is idempotent and does not delete occurrence rows.

alter table public.tasks drop constraint if exists tasks_status_check;

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

-- Completes before this build stored neither completed_at nor awarded_xp,
-- so Mark not done treated every one of them as outside the 7-day window.
update public.tasks
set
  completed_at = coalesce(completed_at, updated_at),
  awarded_xp = coalesce(awarded_xp, xp_value)
where status = 'completed'
  and (completed_at is null or awarded_xp is null);

-- The installed app writes status = completed and then reloads the row.
-- If completed_at is still null, Mark not done reports the 7-day window as closed.
-- Fill the snapshot in the same update so that reload can undo.
create or replace function public.tasks_fill_completion_snapshot()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists tasks_fill_completion_snapshot on public.tasks;

create trigger tasks_fill_completion_snapshot
before update on public.tasks
for each row
execute function public.tasks_fill_completion_snapshot();

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

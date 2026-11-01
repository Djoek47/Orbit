alter table if exists public.calendar_events
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved'));

alter table if exists public.calendar_events
  add column if not exists created_by_member_id uuid references public.household_members(id) on delete set null;

create index if not exists calendar_events_pending_idx
  on public.calendar_events (household_id, approval_status)
  where approval_status = 'pending';

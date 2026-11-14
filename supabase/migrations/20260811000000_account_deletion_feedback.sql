-- Optional churn feedback captured before account deletion (best-effort).
create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  reason text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_feedback_created_at_idx
  on public.account_deletion_feedback (created_at desc);

alter table public.account_deletion_feedback enable row level security;

-- Authenticated users may insert a row for themselves only (no select/update/delete for clients).
drop policy if exists account_deletion_feedback_insert_own on public.account_deletion_feedback;
create policy account_deletion_feedback_insert_own
  on public.account_deletion_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.submit_account_deletion_feedback(
  p_reason text,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required';
  end if;

  select email into mail from auth.users where id = uid;

  insert into public.account_deletion_feedback (user_id, email, reason, detail)
  values (uid, mail, trim(p_reason), nullif(trim(coalesce(p_detail, '')), ''));
end;
$$;

grant execute on function public.submit_account_deletion_feedback(text, text) to authenticated;

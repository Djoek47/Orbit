-- Console: Users view, and routing so every message and error lands in the right section.
--
-- 1. support_tickets.section — 'credits' | 'errors' | 'support', set automatically on insert
--    (app feedback, Resend inbound email, anything) from the category and the wording.
-- 2. app_error_reports gains user_id / ticket_ref / section, so errors attached to a support
--    message show under Errors (or Credits for billing / Poppins) and link back to the ticket.
-- 3. console_users() — one row per person (staff only): role, household, plan, last seen.
-- Safe to run more than once.

-- ── Routing ────────────────────────────────────────────────────────────────────────────
create or replace function public.console_section(p_category text, p_text text, p_error_count int default 0)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(p_category, '')) in ('billing', 'poppins', 'credits', 'billing & credits')
      or coalesce(p_text, '') ~* '\m(credits?|packs?|purchas\w*|refund\w*|charged?|charges|subscri\w*|premium|trial|receipts?|billing|payments?|paid|poppins actions?|app store|apple pay)\M'
      then 'credits'
    when coalesce(p_error_count, 0) > 0
      or lower(coalesce(p_category, '')) in ('tasks', 'rewards', 'calendar', 'grocery', 'settings', 'network', 'unknown', 'bug', 'crash')
      or coalesce(p_text, '') ~* '\m(crash\w*|bugs?|errors?|broken|freez\w*|stuck|not working|doesn''t work|won''t (open|load|sync))\M'
      then 'errors'
    else 'support'
  end;
$$;

alter table public.support_tickets add column if not exists section text not null default 'support';
do $$ begin
  alter table public.support_tickets add constraint support_tickets_section_check check (section in ('support', 'credits', 'errors'));
exception when duplicate_object then null; end $$;
create index if not exists support_tickets_section_idx on public.support_tickets (section, received_at desc);

create or replace function public.support_tickets_route()
returns trigger
language plpgsql
as $$
begin
  -- Staff can move a ticket by hand (update of section); only route automatically on insert.
  if tg_op = 'INSERT' then
    new.section := public.console_section(new.category, new.subject || ' ' || new.body, new.error_count);
    if new.category is null then
      new.category := case new.section when 'credits' then 'Billing & credits' when 'errors' then 'Bug' else 'Feedback' end;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists support_tickets_route on public.support_tickets;
create trigger support_tickets_route before insert on public.support_tickets
  for each row execute function public.support_tickets_route();

-- Existing tickets
update public.support_tickets
   set section = public.console_section(category, subject || ' ' || body, error_count)
 where section = 'support';

-- ── Error reports ──────────────────────────────────────────────────────────────────────
alter table public.app_error_reports add column if not exists user_id uuid default auth.uid();
alter table public.app_error_reports add column if not exists ticket_ref text;
alter table public.app_error_reports add column if not exists section text not null default 'errors';
create index if not exists app_error_reports_ticket_idx on public.app_error_reports (ticket_ref);

create or replace function public.app_error_reports_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.section := case when lower(coalesce(new.category, '')) in ('billing', 'poppins') then 'credits' else 'errors' end;
  -- Fill the household from the reporter when the app didn't send one.
  if new.household_id is null and new.user_id is not null then
    select m.household_id into new.household_id
      from household_members m
     where m.user_id = new.user_id and m.status = 'active'
     order by m.created_at
     limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists app_error_reports_route on public.app_error_reports;
create trigger app_error_reports_route before insert on public.app_error_reports
  for each row execute function public.app_error_reports_route();

update public.app_error_reports
   set section = case when lower(coalesce(category, '')) in ('billing', 'poppins') then 'credits' else 'errors' end;

-- console_errors now also returns section, category and the tickets the error came with.
drop function if exists public.console_errors(int);
create or replace function public.console_errors(p_days int default 9)
returns table (
  fingerprint text, title text, source text, category text, section text,
  total integer, households integer, last_at timestamptz, per_day integer[], tickets text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then
    raise exception 'not allowed';
  end if;
  return query
  select
    e.fingerprint,
    (array_agg(e.title order by e.at desc))[1],
    (array_agg(e.source order by e.at desc))[1],
    (array_agg(e.category order by e.at desc))[1],
    (array_agg(e.section order by e.at desc))[1],
    count(*)::int,
    count(distinct e.household_id)::int,
    max(e.at),
    array(select count(x.id)::int from generate_series(p_days - 1, 0, -1) d
          left join app_error_reports x on x.fingerprint = e.fingerprint
            and x.at::date = (now() - make_interval(days => d))::date
          group by d order by d desc),
    array_remove(array_agg(distinct e.ticket_ref), null)
  from app_error_reports e
  where e.at >= now() - make_interval(days => p_days)
  group by e.fingerprint
  order by count(*) desc
  limit 200;
end;
$$;
revoke all on function public.console_errors(int) from public;
grant execute on function public.console_errors(int) to authenticated;

-- ── Users ──────────────────────────────────────────────────────────────────────────────
-- One row per person in a household (shared tablets included, marked by role). Email is
-- returned for replies and search; the console masks it unless "Show names" is on.
create or replace function public.console_users()
returns table (
  user_code text,
  display_name text,
  email text,
  role text,
  member_status text,
  household_code text,
  household_status text,
  joined_at timestamptz,
  last_seen_at timestamptz,
  last_sign_in_at timestamptz,
  xp integer,
  streak integer,
  tickets integer,
  errors_30d integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_console_staff() then
    raise exception 'not allowed';
  end if;
  return query
  select
    'U-' || upper(substr(md5(coalesce(m.user_id::text, m.id::text)), 1, 5)),
    coalesce(m.display_name, p.display_name),
    coalesce(p.email, u.email)::text,
    m.role,
    m.status,
    public.household_code(h.id),
    case
      when h.premium_expires_at is null then 'never'
      when h.premium_expires_at < now() then 'lapsed'
      when h.premium_in_trial then 'trial'
      when h.premium_will_renew = false then 'cancel'
      else 'paid'
    end,
    m.created_at,
    m.last_seen_at,
    u.last_sign_in_at,
    m.xp,
    m.streak,
    (select count(*)::int from support_tickets t where m.user_id is not null and t.user_id = m.user_id),
    (select count(*)::int from app_error_reports e where m.user_id is not null and e.user_id = m.user_id
       and e.at >= now() - interval '30 days')
  from household_members m
  join households h on h.id = m.household_id
  left join profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.status <> 'removed';
end;
$$;
revoke all on function public.console_users() from public;
grant execute on function public.console_users() to authenticated;

-- Live updates in the console for new errors too (tickets are already published).
do $$ begin
  alter publication supabase_realtime add table public.app_error_reports;
exception when duplicate_object then null; when undefined_object then null; end $$;

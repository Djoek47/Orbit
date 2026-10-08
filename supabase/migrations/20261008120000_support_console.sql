-- ChoreMaxx support console: staff list, support tickets, error reports, and read-only
-- console views that show billing and usage numbers without household content.
--
-- Privacy rules this file enforces:
--   * Only people on console_staff can read anything here (RLS + security-definer checks).
--   * Views never expose tasks, messages, photos, Poppins transcripts or children's names.
--   * Households appear as a stable code (HH-XXXX); the real name is a separate column the
--     console hides unless a staff member turns "Show names" on — and that is logged.

-- ── Staff ───────────────────────────────────────────────────────────────────────────────
create table if not exists public.console_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'support' check (role in ('support', 'owner')),
  created_at timestamptz not null default now()
);
alter table public.console_staff enable row level security;
-- No client policies: staff rows are managed from the SQL editor only.

create or replace function public.is_console_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.console_staff where user_id = auth.uid());
$$;
revoke all on function public.is_console_staff() from public;
grant execute on function public.is_console_staff() to authenticated;

-- Every time someone reveals names or replies, a line here.
create table if not exists public.console_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  staff_id uuid not null default auth.uid(),
  action text not null,               -- 'reveal_names' | 'reply' | 'status' | 'view_household'
  target text                          -- ticket ref or household code
);
alter table public.console_audit enable row level security;
create policy console_audit_insert on public.console_audit
  for insert to authenticated with check (public.is_console_staff() and staff_id = auth.uid());
create policy console_audit_read on public.console_audit
  for select to authenticated using (public.is_console_staff());

-- ── Household code ──────────────────────────────────────────────────────────────────────
-- Stable, short, not reversible to the id by eye. Same alphabet as the app's match code.
create or replace function public.household_code(p_id uuid)
returns text
language sql
immutable
as $$
  select 'HH-' || upper(substr(translate(encode(extensions.digest(p_id::text, 'sha256'), 'base64'),
    '+/=OoIl01', 'XYZQRSTUV'), 1, 4));
$$;

-- ── Support tickets ─────────────────────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- "CMX-4821", shown to the customer too
  received_at timestamptz not null default now(),
  via text not null check (via in ('app', 'email')),
  status text not null default 'new' check (status in ('new', 'open', 'waiting', 'closed')),
  category text,                                  -- Billing | Credits | Shared device | Feedback | Bug
  subject text not null default '',
  body text not null default '',
  from_name text,
  from_email text,                                -- needed to reply; masked in the list view
  user_id uuid,
  household_id uuid references public.households(id) on delete set null,
  member_role text,
  app_version text,
  device text,
  error_count integer not null default 0,
  error_log text,                                 -- what the app attached, if anything
  resend_email_id text unique,                    -- inbound email id, for dedupe
  meta jsonb not null default '{}'::jsonb
);
create index if not exists support_tickets_received_idx on public.support_tickets (received_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
alter table public.support_tickets enable row level security;
create policy support_tickets_staff_read on public.support_tickets
  for select to authenticated using (public.is_console_staff());
create policy support_tickets_staff_update on public.support_tickets
  for update to authenticated using (public.is_console_staff()) with check (public.is_console_staff());
-- Inserts come only from edge functions (service role).

create table if not exists public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  at timestamptz not null default now(),
  direction text not null check (direction in ('out', 'in')),  -- out = staff reply, in = customer reply by email
  author text,
  body text not null,
  resend_email_id text unique
);
create index if not exists support_replies_ticket_idx on public.support_replies (ticket_id, at);
alter table public.support_replies enable row level security;
create policy support_replies_staff_read on public.support_replies
  for select to authenticated using (public.is_console_staff());

-- ── Error reports ───────────────────────────────────────────────────────────────────────
-- The app already keeps an error log on the device and attaches it to support messages.
-- This table lets it also report errors as they happen (grouped by fingerprint).
create table if not exists public.app_error_reports (
  id bigserial primary key,
  at timestamptz not null default now(),
  household_id uuid references public.households(id) on delete set null,
  source text not null,          -- e.g. 'billing · access-provider'
  category text,                 -- 'billing' | 'voice' | 'sync' | ...
  title text not null,
  message text,
  app_version text,
  fingerprint text not null      -- source + normalized title, so repeats group together
);
create index if not exists app_error_reports_fp_idx on public.app_error_reports (fingerprint, at desc);
alter table public.app_error_reports enable row level security;
create policy app_error_reports_insert on public.app_error_reports
  for insert to authenticated with check (true);
create policy app_error_reports_staff_read on public.app_error_reports
  for select to authenticated using (public.is_console_staff());

-- ── Console views (security definer functions — staff only) ────────────────────────────
-- One row per household: status, plan, time left, AI use. No content.
create or replace function public.console_households()
returns table (
  code text,
  household_name text,
  status text,               -- paid | trial | cancel | grace | lapsed | never
  product_id text,
  in_trial boolean,
  expires_at timestamptz,
  will_renew boolean,
  environment text,
  days_left integer,
  members integer,
  shared_devices integer,
  bought_actions integer,
  spent_bought_actions integer,
  actions_this_month integer,
  last_active timestamptz,
  created_at timestamptz
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
    public.household_code(h.id),
    h.name,
    case
      when h.premium_expires_at is null then 'never'
      when h.premium_expires_at < now() then 'lapsed'
      when h.premium_in_trial then 'trial'
      when h.premium_will_renew = false then 'cancel'
      else 'paid'
    end,
    h.premium_product_id,
    coalesce(h.premium_in_trial, false),
    h.premium_expires_at,
    h.premium_will_renew,
    h.premium_environment,
    case when h.premium_expires_at is null then null
         else floor(extract(epoch from (h.premium_expires_at - now())) / 86400)::int end,
    (select count(*)::int from household_members m where m.household_id = h.id
       and m.role <> 'shared-device' and m.status in ('active', 'invited')),
    (select count(*)::int from household_members m where m.household_id = h.id
       and m.role = 'shared-device' and m.status = 'active'),
    (select coalesce(sum(g.tokens), 0)::int from token_grants g where g.household_id = h.id and g.pack <> 'mock'),
    (select coalesce(sum(g.consumed), 0)::int from token_grants g where g.household_id = h.id and g.pack <> 'mock'),
    (select coalesce(sum(a.tokens), 0)::int from act_events a where a.household_id = h.id
       and a.occurred_at >= date_trunc('month', now())),
    (select max(m.last_seen_at) from household_members m where m.household_id = h.id),
    h.created_at
  from households h;
end;
$$;
revoke all on function public.console_households() from public;
grant execute on function public.console_households() to authenticated;

-- Packs sold by month (from grants; mock buys excluded).
create or replace function public.console_pack_sales(p_months int default 6)
returns table (month date, pack text, packs integer, actions integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then raise exception 'not allowed'; end if;
  return query
  select date_trunc('month', g.granted_at)::date, g.pack, count(*)::int, sum(g.tokens)::int
  from token_grants g
  where g.pack <> 'mock' and g.granted_at >= date_trunc('month', now()) - make_interval(months => p_months - 1)
  group by 1, 2 order by 1, 2;
end;
$$;
revoke all on function public.console_pack_sales(int) from public;
grant execute on function public.console_pack_sales(int) to authenticated;

-- What Poppins was asked to do this month, by kind. Counts only.
create or replace function public.console_ai_mix()
returns table (act_kind text, acts integer, actions integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then raise exception 'not allowed'; end if;
  return query
  select a.act_kind, count(*)::int, coalesce(sum(a.tokens), 0)::int
  from act_events a
  where a.occurred_at >= date_trunc('month', now())
  group by 1 order by 3 desc;
end;
$$;
revoke all on function public.console_ai_mix() from public;
grant execute on function public.console_ai_mix() to authenticated;

-- Errors grouped by fingerprint, last N days, with a per-day series for the sparkline.
create or replace function public.console_errors(p_days int default 9)
returns table (fingerprint text, title text, source text, category text, total integer,
               households integer, last_at timestamptz, per_day integer[])
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then raise exception 'not allowed'; end if;
  return query
  select e.fingerprint, max(e.title), max(e.source), max(e.category), count(*)::int,
         count(distinct e.household_id)::int, max(e.at),
         array(select count(*)::int from generate_series(p_days - 1, 0, -1) d
               left join app_error_reports x on x.fingerprint = e.fingerprint
                 and x.at::date = (now() - make_interval(days => d))::date
               group by d order by d desc)
  from app_error_reports e
  where e.at >= now() - make_interval(days => p_days)
  group by e.fingerprint
  order by count(*) desc;
end;
$$;
revoke all on function public.console_errors(int) from public;
grant execute on function public.console_errors(int) to authenticated;

-- Why accounts were deleted (table already exists in the app's schema).
create or replace function public.console_deletion_reasons(p_days int default 30)
returns table (reason text, n integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then raise exception 'not allowed'; end if;
  return query
  select coalesce(f.reason, 'Other'), count(*)::int
  from account_deletion_feedback f
  where f.created_at >= now() - make_interval(days => p_days)
  group by 1 order by 2 desc;
end;
$$;
revoke all on function public.console_deletion_reasons(int) from public;
grant execute on function public.console_deletion_reasons(int) to authenticated;

-- ── Add yourself as staff (run once, with your own email) ───────────────────────────────
-- insert into public.console_staff (user_id, email, role)
-- select id, email, 'owner' from auth.users where email = 'you@choremaxx.app';

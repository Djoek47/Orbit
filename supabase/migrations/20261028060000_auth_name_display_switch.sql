-- Names in Supabase's Users list: a switch, and a log of every time it was flipped.
--
-- The previous migration copied each person's name into their account details so the dashboard
-- showed "Mike" instead of a privaterelay address. That is useful for support and awkward for
-- privacy, so it is now a setting rather than something the app always does:
--
--   select * from public.set_auth_names_visible(true,  'support week');  -- show names
--   select * from public.set_auth_names_visible(false, 'done');          -- hide them again
--   select * from public.auth_name_display_log order by at desc;         -- when, by whom, how many
--
-- Off by default, and this migration hides the names the earlier one wrote. Nothing is lost:
-- the name always lives in public.profiles.display_name, and turning the switch back on copies
-- it across again. A trigger keeps new sign-ups and renames in step with whatever the switch says,
-- so the app never has to care.

-- ── The switch ──────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_name_display (
  id boolean primary key default true check (id),   -- one row, always
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.auth_name_display (id, enabled) values (true, false) on conflict (id) do nothing;

alter table public.auth_name_display enable row level security;
-- No policies: the app never reads or writes this. Only the SQL editor / service role.

comment on table public.auth_name_display is
  'Whether people''s names are shown in Supabase''s Users list. Flip with set_auth_names_visible().';

-- ── The log ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.auth_name_display_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  enabled boolean not null,
  actor text not null,
  affected integer not null default 0,
  note text
);
alter table public.auth_name_display_log enable row level security;

comment on table public.auth_name_display_log is
  'Every flip of the names switch: when, who, how many accounts changed, and why.';

-- ── Who flipped it ──────────────────────────────────────────────────────────────────────
create or replace function public.auth_name_actor()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
begin
  -- A signed-in staff member when called through the API; the database role in the SQL editor.
  select email into who from auth.users where id = auth.uid();
  return coalesce(who, current_user);
end;
$$;

-- ── Flip it ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_auth_names_visible(p_enabled boolean, p_note text default null)
returns table (enabled boolean, affected integer, at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  who text := public.auth_name_actor();
  now_at timestamptz := now();
begin
  if p_enabled then
    -- Show: copy each person's own name across. Accounts with no name stay as they are.
    with changed as (
      update auth.users u
         set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('full_name', p.display_name, 'name', p.display_name, 'display_name', p.display_name)
        from public.profiles p
       where p.id = u.id
         and coalesce(trim(p.display_name), '') <> ''
         and coalesce(u.raw_user_meta_data->>'full_name', '') is distinct from p.display_name
      returning 1
    )
    select count(*) into n from changed;
  else
    -- Hide: drop the name keys. public.profiles keeps the name, so nothing is lost.
    with changed as (
      update auth.users u
         set raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'full_name' - 'name' - 'display_name')
       where u.raw_user_meta_data ?| array['full_name', 'name', 'display_name']
      returning 1
    )
    select count(*) into n from changed;
  end if;

  update public.auth_name_display
     set enabled = p_enabled, updated_at = now_at, updated_by = who
   where id;

  insert into public.auth_name_display_log (at, enabled, actor, affected, note)
  values (now_at, p_enabled, who, n, p_note);

  return query select p_enabled, n, now_at;
end;
$$;

-- Nobody but the SQL editor / service role may flip it. (anon and authenticated exist on
-- Supabase but not on a bare Postgres, so each is revoked only if present.)
revoke all on function public.set_auth_names_visible(boolean, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.set_auth_names_visible(boolean, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.set_auth_names_visible(boolean, text) from authenticated';
  end if;
end;
$$;

comment on function public.set_auth_names_visible(boolean, text) is
  'Show or hide people''s names in the Users list, and log the change. SQL editor / service role only.';

-- ── Keep new sign-ups and renames in step ───────────────────────────────────────────────
create or replace function public.sync_auth_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  show_names boolean;
begin
  select enabled into show_names from public.auth_name_display where id;
  if coalesce(show_names, false) and coalesce(trim(new.display_name), '') <> '' then
    update auth.users
       set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
           || jsonb_build_object('full_name', new.display_name, 'name', new.display_name, 'display_name', new.display_name)
     where id = new.id;
  elsif not coalesce(show_names, false) then
    update auth.users
       set raw_user_meta_data = (coalesce(raw_user_meta_data, '{}'::jsonb) - 'full_name' - 'name' - 'display_name')
     where id = new.id
       and raw_user_meta_data ?| array['full_name', 'name', 'display_name'];
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_auth_name on public.profiles;
create trigger profiles_sync_auth_name
  after insert or update of display_name on public.profiles
  for each row execute function public.sync_auth_name_from_profile();

-- Start hidden: undo what 20261028030000 wrote, and record it as the first line in the log.
select public.set_auth_names_visible(false, 'default: names hidden in the dashboard');

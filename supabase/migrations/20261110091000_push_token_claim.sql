-- Push tokens: register reliably, and record why a phone can't.
--
-- 1) register_push_token(token, platform): the signed-in person claims this phone's token.
--    The old client upsert updated the existing row, and when another account had used the
--    same phone, RLS (user_id = auth.uid()) blocked the update — so the token stayed with the
--    previous account and pushes for the new one went nowhere. Pushes go to whoever is signed
--    in on the phone now, so the claim moves the token from any other account to this one.
--
-- 2) push_registration_problems: one row per (person, device) with the last reason the phone
--    gave no token (permission denied, missing entitlement, simulator…). Read it with:
--      select * from public.push_registration_problems order by updated_at desc;
--    Server-only: clients write through report_push_problem, cannot read it.

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_token is null or char_length(p_token) < 10 or char_length(p_token) > 300 then
    raise exception 'invalid token';
  end if;

  -- The phone belongs to whoever is signed in now; drop other accounts' claim on it.
  delete from public.push_tokens where token = p_token and user_id is distinct from v_user and member_id is null;

  insert into public.push_tokens (user_id, member_id, token, platform)
  values (v_user, null, p_token, coalesce(nullif(trim(p_platform), ''), 'unknown'))
  on conflict (token, member_id) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();

  delete from public.push_registration_problems where user_id = v_user;
end;
$$;

create table if not exists public.push_registration_problems (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null default 'unknown',
  platform text,
  reason text not null,
  app_version text,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

alter table public.push_registration_problems enable row level security;

comment on table public.push_registration_problems is
  'Last reason each signed-in phone could not get a push token. Cleared when it registers.';

create or replace function public.report_push_problem(
  p_reason text,
  p_platform text default null,
  p_device_id text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;
  insert into public.push_registration_problems (user_id, device_id, platform, reason, app_version)
  values (
    v_user,
    coalesce(nullif(left(p_device_id, 80), ''), 'unknown'),
    left(p_platform, 40),
    left(coalesce(p_reason, 'unknown'), 500),
    left(p_app_version, 40)
  )
  on conflict (user_id, device_id) do update
    set reason = excluded.reason,
        platform = excluded.platform,
        app_version = excluded.app_version,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.report_push_problem(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.report_push_problem(text, text, text, text) to authenticated;

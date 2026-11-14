-- Daily digest cron: call the daily-digest edge function once an hour.
--
-- The function decides who gets anything: it only acts on households whose local clock has just
-- struck 8am or 6pm, and it writes each household's digest once per local day per slot. So an
-- hourly tick is cheap, and a repeated tick is harmless.
--
-- Secrets live in Vault, never in cron.job.command (that table is readable by any role granted
-- the cron schema). Create them once per project before this migration runs:
--
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',        'service_role_key');
--
-- Without those two secrets the job is still scheduled but each run is a no-op that logs a
-- notice, so this migration is safe to apply before the secrets exist.

-- 1) Extensions ------------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron extension not available: %', sqlerrm;
end;
$$;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net extension not available: %', sqlerrm;
end;
$$;

-- 2) The call --------------------------------------------------------------------------------
create or replace function public.run_daily_digest()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    raise notice 'daily digest skipped: project_url / service_role_key not set in Vault';
    return;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
exception when others then
  -- A failed tick must never break the cron worker; the next hour tries again.
  raise notice 'daily digest post failed: %', sqlerrm;
end;
$$;

revoke all on function public.run_daily_digest() from public, anon, authenticated;

comment on function public.run_daily_digest() is
  'Hourly: ask the daily-digest edge function to send 8am / 6pm digests to households whose local clock just struck.';

-- 3) The schedule ----------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('daily-digest');
exception when others then
  null; -- not scheduled yet
end;
$$;

do $$
begin
  perform cron.schedule('daily-digest', '0 * * * *', 'select public.run_daily_digest();');
exception when others then
  raise notice 'daily digest schedule skipped: %', sqlerrm;
end;
$$;

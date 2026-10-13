-- ChoreMaxx console, live: household codes for ticket links, and realtime for the inbox.
-- Run after 20261008120000_support_console.sql.

-- Codes for a set of household ids (tickets carry the id; the console shows the code).
create or replace function public.console_household_codes(p_ids uuid[])
returns table (id uuid, code text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_console_staff() then raise exception 'not allowed'; end if;
  return query select h.id, public.household_code(h.id) from households h where h.id = any(p_ids);
end;
$$;
revoke all on function public.console_household_codes(uuid[]) from public;
grant execute on function public.console_household_codes(uuid[]) to authenticated;

-- New tickets and replies appear in the console without a refresh. RLS still applies:
-- realtime only delivers rows the signed-in staff member can select.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_tickets') then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_replies') then
    alter publication supabase_realtime add table public.support_replies;
  end if;
end $$;

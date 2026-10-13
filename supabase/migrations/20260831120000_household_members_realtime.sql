-- Push member status / user_id changes to admin clients (connection badge, roster).

do $$
begin
  begin
    alter publication supabase_realtime add table public.household_members;
  exception when others then null;
  end;
end $$;

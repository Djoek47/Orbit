-- Tasks follow their person when that person is renamed.
--
-- Tasks store the assignee by display name (`assignee_name`) and, when it could be
-- resolved at creation, by id (`assignee_member_id`). Renaming a member changed
-- household_members.display_name only, so their tasks kept the old name. Nobody
-- matched it any more: no one saw "Done", the home card counted it as open
-- forever, and every daily copy was spawned with the old name again.
--
-- 1. A trigger keeps tasks in step on every rename (app, invites, edge functions).
-- 2. A one-time repair fixes tasks that already drifted.

create or replace function public.tasks_follow_member_rename()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.tasks t
       set assignee_name = new.display_name,
           assignee_member_id = new.id
     where t.household_id = new.household_id
       and (
         t.assignee_member_id = new.id
         or (t.assignee_member_id is null
             and lower(trim(t.assignee_name)) = lower(trim(old.display_name)))
       );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_follow_member_rename on public.household_members;
create trigger trg_tasks_follow_member_rename
  after update of display_name on public.household_members
  for each row execute function public.tasks_follow_member_rename();

-- One-time repair: tasks that know their member's id but carry a stale name.
update public.tasks t
   set assignee_name = m.display_name
  from public.household_members m
 where t.assignee_member_id = m.id
   and t.assignee_name is distinct from m.display_name;

-- Fill in the id where the name still matches exactly one member, so future
-- renames can follow it.
update public.tasks t
   set assignee_member_id = m.id
  from public.household_members m
 where t.assignee_member_id is null
   and m.household_id = t.household_id
   and lower(trim(m.display_name)) = lower(trim(t.assignee_name))
   and (select count(*) from public.household_members m2
         where m2.household_id = t.household_id
           and lower(trim(m2.display_name)) = lower(trim(t.assignee_name))) = 1;

-- Custom house rules are display-only family conventions.
-- They must not alter scoring, XP, allowance, or any app mechanic.

alter table public.custom_house_rules enable row level security;

drop policy if exists custom_house_rules_select on public.custom_house_rules;
create policy custom_house_rules_select on public.custom_house_rules
  for select using (public.is_household_member(household_id));

drop policy if exists custom_house_rules_write on public.custom_house_rules;
create policy custom_house_rules_write on public.custom_house_rules
  for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

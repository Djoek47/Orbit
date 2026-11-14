-- A free trial is offered once. Ever.
--
-- The paywall decided "has this house had its trial?" from the household's *current*
-- Premium row (premium_in_trial + premium_expires_at). That row is a snapshot of the
-- current period, not a history: it was empty when the trial's sync never landed, and
-- it is cleared when a subscription moves to another household. Either way the house
-- looked brand new, and with Apple's eligibility check unknown (it errs to "eligible")
-- "Start free trial" came back after the trial had already run out.
--
-- trial_used_at is a permanent mark, on the household and on the person:
--   * set by the server (sync-entitlement) the first time a trial is reported;
--   * never cleared, by anyone — once set it stays;
--   * clients cannot write it at all.

alter table public.households add column if not exists trial_used_at timestamptz;
alter table public.profiles   add column if not exists trial_used_at timestamptz;

comment on column public.households.trial_used_at is
  'First time a free trial was seen for this household. Permanent: never cleared. The paywall '
  'never offers a trial when set.';
comment on column public.profiles.trial_used_at is
  'First time this person started a free trial, in any household. Permanent: never cleared.';

create or replace function public.keep_trial_used_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clients may not set or change it.
  if auth.uid() is not null and tg_op = 'UPDATE'
     and new.trial_used_at is distinct from old.trial_used_at then
    new.trial_used_at := old.trial_used_at;
  end if;
  if auth.uid() is not null and tg_op = 'INSERT' then
    new.trial_used_at := null;
  end if;
  -- Nobody clears it, the server included.
  if tg_op = 'UPDATE' and old.trial_used_at is not null then
    new.trial_used_at := least(old.trial_used_at, coalesce(new.trial_used_at, old.trial_used_at));
  end if;
  return new;
end;
$$;

drop trigger if exists households_keep_trial_used_at on public.households;
create trigger households_keep_trial_used_at
  before insert or update on public.households
  for each row execute function public.keep_trial_used_at();

drop trigger if exists profiles_keep_trial_used_at on public.profiles;
create trigger profiles_keep_trial_used_at
  before insert or update on public.profiles
  for each row execute function public.keep_trial_used_at();

-- Backfill from what is still on record. A household that has any Premium period on file has
-- been through the paywall's trial door (or paid outright, where "renew" wins anyway).
update public.households
   set trial_used_at = coalesce(premium_updated_at, now())
 where trial_used_at is null
   and (premium_in_trial or premium_expires_at is not null);

update public.profiles p
   set trial_used_at = coalesce(h.premium_updated_at, now())
  from public.households h
 where p.trial_used_at is null
   and h.premium_purchased_by = p.id
   and h.premium_in_trial;

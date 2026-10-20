-- Staging repair for make-v32 RLS harden.
-- Use this if 20261006013743 failed with:
--   ERROR: 42P01: relation "public.xp_ledger_entries" does not exist
-- Also fixes advisor findings: nova_briefings SECURITY DEFINER + profiles auth.uid() initplan.
-- Fully idempotent. Safe to re-run.

-- ---------------------------------------------------------------------------
-- A) Finish optional-table RLS (skip tables that don't exist yet)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.itineraries') is not null then
    alter table public.itineraries enable row level security;
    drop policy if exists itineraries_all on public.itineraries;
    create policy itineraries_all on public.itineraries for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.itinerary_stops') is not null then
    alter table public.itinerary_stops enable row level security;
    drop policy if exists itinerary_stops_all on public.itinerary_stops;
    create policy itinerary_stops_all on public.itinerary_stops for all
      using (
        exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id
            and public.is_household_member(i.household_id)
        )
      )
      with check (
        exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id
            and public.is_household_member(i.household_id)
        )
      );
  end if;

  if to_regclass('public.task_templates') is not null then
    alter table public.task_templates enable row level security;
    drop policy if exists task_templates_all on public.task_templates;
    create policy task_templates_all on public.task_templates for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.xp_ledger_entries') is not null then
    alter table public.xp_ledger_entries enable row level security;
    drop policy if exists xp_ledger_all on public.xp_ledger_entries;
    create policy xp_ledger_all on public.xp_ledger_entries for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.streak_rescues') is not null then
    alter table public.streak_rescues enable row level security;
    drop policy if exists streak_rescues_all on public.streak_rescues;
    create policy streak_rescues_all on public.streak_rescues for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.day_classifications') is not null then
    alter table public.day_classifications enable row level security;
    drop policy if exists day_classifications_all on public.day_classifications;
    create policy day_classifications_all on public.day_classifications for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.recess_periods') is not null then
    alter table public.recess_periods enable row level security;
    drop policy if exists recess_periods_all on public.recess_periods;
    create policy recess_periods_all on public.recess_periods for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.crown_awards') is not null then
    alter table public.crown_awards enable row level security;
    drop policy if exists crown_awards_all on public.crown_awards;
    create policy crown_awards_all on public.crown_awards for all
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;

  if to_regclass('public.monitor_cron_cursor') is not null then
    alter table public.monitor_cron_cursor enable row level security;
    comment on table public.monitor_cron_cursor is
      'Single-row cursor for poppins-monitor cron; RLS on, no client policies (service_role only).';
  end if;
end $$;

-- Ensure critical harden pieces exist even if the first migration aborted mid-file.
-- (invites / members / generate_member_invite / token_grants usually applied before the crash.)

drop policy if exists invites_select on public.household_invites;
create policy invites_select on public.household_invites for select
  using (public.is_household_member(household_id));

drop policy if exists members_insert on public.household_members;
create policy members_insert on public.household_members for insert
  with check (
    public.is_household_admin(household_id)
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1
        from public.households h
        where h.id = household_id
          and h.owner_id = (select auth.uid())
      )
    )
  );

-- token_grants INSERT stay revoked (no policy). Consume-only trigger if table exists.
do $$
begin
  if to_regclass('public.token_grants') is not null then
    drop policy if exists token_grants_insert on public.token_grants;
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'enforce_token_grants_consume_only'
    ) then
      drop trigger if exists token_grants_consume_only on public.token_grants;
      create trigger token_grants_consume_only
        before update on public.token_grants
        for each row
        execute function public.enforce_token_grants_consume_only();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- B) Advisor: nova_briefings SECURITY DEFINER → security_invoker
-- ---------------------------------------------------------------------------
create or replace view public.nova_briefings
  with (security_invoker = true)
as
  select id, household_id, title, summary, actions, metadata, created_at, updated_at
  from public.ai_briefings
  where briefing_type = 'daily';

-- ---------------------------------------------------------------------------
-- C) Advisor: profiles auth.uid() initplan → (select auth.uid())
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = (select auth.uid()));

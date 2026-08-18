-- Revision D Phase 1 schema — Late Credit, Expiry, Streak Rescue, Ledger, Recess prep
-- Spec: docs/logic/choremaxx-revision-d-spec.md §6

-- Occurrence status: add expired, migrate missed → expired
alter table if exists public.task_occurrences
  add column if not exists completed_late boolean not null default false;

-- Members: streak rescue / cliff fields
alter table if exists public.household_members
  add column if not exists free_rescue_used boolean not null default false;

alter table if exists public.household_members
  add column if not exists consecutive_missed_days integer not null default 0;

alter table if exists public.household_members
  add column if not exists streak_ended_at timestamptz;

alter table if exists public.household_members
  add column if not exists streak_ended_reason text
    check (streak_ended_reason is null or streak_ended_reason in ('consecutive', 'rolling'));

alter table if exists public.household_members
  add column if not exists homework_proof_required boolean not null default true;

-- Household timezone (default America/Toronto per §6)
alter table if exists public.households
  add column if not exists timezone text not null default 'America/Toronto';

-- XP ledger
create table if not exists public.xp_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null check (
    type in (
      'task_completed',
      'late_credit',
      'bundle_bonus',
      'streak_rescue',
      'reversal',
      'adjustment'
    )
  ),
  delta integer not null,
  balance_after integer not null,
  label text not null,
  occurrence_id uuid,
  week_key text,
  created_at timestamptz not null default now()
);

create index if not exists xp_ledger_member_week_idx
  on public.xp_ledger_entries (member_id, week_key);

-- Streak rescues (accepted offers; settled at week close)
create table if not exists public.streak_rescues (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  missed_date date not null,
  week_key text not null,
  pct_owed numeric not null default 0.10,
  free boolean not null default false,
  settled_at timestamptz,
  deducted_xp integer,
  created_at timestamptz not null default now()
);

-- Day classifications cache
create table if not exists public.day_classifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  local_date date not null,
  day_class text not null check (day_class in ('complete', 'missed', 'neutral', 'recess')),
  unique (member_id, local_date)
);

-- Recess periods (Phase 3 tables created early so migrations stay ordered)
create table if not exists public.recess_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  start_date date not null,
  end_date date,
  created_by uuid references public.household_members (id),
  created_at timestamptz not null default now(),
  is_backdated boolean not null default false
);

-- Crown awards (Phase 2)
create table if not exists public.crown_awards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  crown_type text not null check (crown_type in ('weekly', 'monthly')),
  period_key text not null,
  net_xp integer not null,
  rank integer not null,
  tied boolean not null default false,
  awarded_at timestamptz not null default now()
);

-- Custom house rules (Phase 4)
create table if not exists public.custom_house_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  body text not null check (char_length(body) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.xp_ledger_entries is
  'Revision D §1.6 — every XP mutation writes a row via applyXpChange.';

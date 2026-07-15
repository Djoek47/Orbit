-- Orbit Supabase MVP schema
-- Safe starting point for an Expo Go app that is currently mock-first.
-- Run this in a Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  household_type text not null default 'family',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  timezone text not null default 'America/Montreal',
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('owner', 'admin', 'adult', 'child', 'guest')),
  status text not null default 'active' check (status in ('invited', 'pending', 'active', 'removed')),
  avatar_symbol text,
  xp integer not null default 0,
  load_share integer not null default 0 check (load_share >= 0 and load_share <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invite_code text not null unique,
  invite_link text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  category text not null,
  assignee_name text not null,
  due_label text not null,
  xp_value integer not null default 0,
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly', 'weekdays')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  assigned_member_id uuid references public.household_members(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null,
  quantity text not null default '1 item',
  location text not null default 'pantry' check (location in ('fridge', 'freezer', 'pantry', 'bathroom', 'cleaning')),
  status text not null default 'missing' check (status in ('available', 'low', 'missing', 'purchased')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  category text not null default 'family' check (category in ('school', 'activity', 'appointment', 'family', 'routine')),
  date_label text not null,
  time_label text not null,
  location text,
  responsible_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  cost integer not null default 0,
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  icon text not null,
  progress numeric(4, 3) not null default 0 check (progress >= 0 and progress <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete cascade,
  earned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (badge_id, member_id)
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  amount integer not null,
  reason text not null,
  related_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_scores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_completion_rate integer not null default 0,
  grocery_readiness integer not null default 0,
  calendar_coverage integer not null default 0,
  momentum_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.nova_briefings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  summary text not null,
  actions text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists households_owner_id_idx on public.households(owner_id);
create index if not exists household_members_household_id_idx on public.household_members(household_id);
create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists household_invites_household_id_idx on public.household_invites(household_id);
create index if not exists tasks_household_id_status_idx on public.tasks(household_id, status);
create index if not exists task_assignments_household_id_idx on public.task_assignments(household_id);
create index if not exists grocery_items_household_id_status_idx on public.grocery_items(household_id, status);
create index if not exists calendar_events_household_id_idx on public.calendar_events(household_id);
create index if not exists rewards_household_id_idx on public.rewards(household_id);
create index if not exists badges_household_id_idx on public.badges(household_id);
create index if not exists user_badges_household_id_idx on public.user_badges(household_id);
create index if not exists xp_transactions_household_id_idx on public.xp_transactions(household_id);
create index if not exists household_scores_household_id_created_at_idx on public.household_scores(household_id, created_at desc);
create index if not exists nova_briefings_household_id_created_at_idx on public.nova_briefings(household_id, created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger household_members_set_updated_at
  before update on public.household_members
  for each row execute function public.set_updated_at();

create trigger household_invites_set_updated_at
  before update on public.household_invites
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger task_assignments_set_updated_at
  before update on public.task_assignments
  for each row execute function public.set_updated_at();

create trigger grocery_items_set_updated_at
  before update on public.grocery_items
  for each row execute function public.set_updated_at();

create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

create trigger badges_set_updated_at
  before update on public.badges
  for each row execute function public.set_updated_at();

create trigger user_badges_set_updated_at
  before update on public.user_badges
  for each row execute function public.set_updated_at();

create trigger nova_briefings_set_updated_at
  before update on public.nova_briefings
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.grocery_items enable row level security;
alter table public.calendar_events enable row level security;
alter table public.rewards enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.household_scores enable row level security;
alter table public.nova_briefings enable row level security;

comment on table public.profiles is 'RLS intent: users can read/update only their own profile; service role can manage all profiles.';
comment on table public.households is 'RLS intent: active household members can read household rows; owners/admins can update household settings.';
comment on table public.household_members is 'RLS intent: active members can read membership for their household; owners/admins manage roles and invitations.';
comment on table public.household_invites is 'RLS intent: owners/admins can create invites; invite-code join flow should validate through an edge function.';
comment on table public.tasks is 'RLS intent: active household members can read tasks; adults/admins create and assign; assigned children can complete their own tasks.';
comment on table public.task_assignments is 'RLS intent: household members can read assignments; assigned members can update completion status within permission boundaries.';
comment on table public.grocery_items is 'RLS intent: active household members can read and update grocery state for their own household.';
comment on table public.calendar_events is 'RLS intent: active household members can read events; adults/admins can create and assign responsibility.';
comment on table public.rewards is 'RLS intent: active members can read rewards; adults/admins manage reward catalog and approvals.';
comment on table public.badges is 'RLS intent: active members can read badges; system/service role updates badge progress.';
comment on table public.user_badges is 'RLS intent: active members can read earned badges for their household; system/service role writes earned badges.';
comment on table public.xp_transactions is 'RLS intent: active members can read household XP history; system/service role writes transactions after task completion.';
comment on table public.household_scores is 'RLS intent: active members can read household momentum; system/service role writes calculated score snapshots.';
comment on table public.nova_briefings is 'RLS intent: active members can read Nova briefings; Nova edge functions/service role creates briefing rows.';

-- Policy placeholders.
-- Implement policies after auth and invite flows are designed. Suggested helper:
-- exists (
--   select 1 from public.household_members hm
--   where hm.household_id = <table>.household_id
--     and hm.user_id = auth.uid()
--     and hm.status = 'active'
-- )

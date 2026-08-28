-- Orbit production schema (Foundation + MVP + Growth tables)
-- Apply in Supabase SQL editor or via `supabase db push` / migrations.

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

-- Core tables first — helper functions below reference household_members.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  phone text,
  apple_sub text unique,
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
  reward_mode text not null default 'weighted' check (reward_mode in ('weighted', 'flat')),
  reward_model text not null default 'full'
    check (reward_model in ('xp_only', 'allowance', 'xp_rewards', 'xp_allowance', 'full')),
  hygiene_rewarded boolean not null default false,
  hygiene_xp integer not null default 5 check (hygiene_xp in (5, 10)),
  member_capabilities jsonb not null default '{}'::jsonb,
  daily_deadline text,
  daily_deadline_pending text,
  daily_deadline_applies_on date,
  allowance_requests_enabled boolean not null default true,
  sidekick_grocery_add boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text,
  role text not null check (role in ('owner', 'admin', 'adult', 'child', 'guest', 'shared-device')),
  shared_with_member_ids uuid[] default null,
  status text not null default 'active' check (status in ('invited', 'pending', 'active', 'removed')),
  avatar_symbol text,
  xp integer not null default 0,
  week_xp integer not null default 0,
  streak integer not null default 0,
  load_share integer not null default 0 check (load_share >= 0 and load_share <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household
      and hm.user_id = auth.uid()
      and hm.status = 'active'
  );
$$;

create or replace function public.household_role(target_household uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select hm.role
  from public.household_members hm
  where hm.household_id = target_household
    and hm.user_id = auth.uid()
    and hm.status = 'active'
  limit 1;
$$;

create or replace function public.is_household_admin(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.household_role(target_household) in ('owner', 'admin');
$$;

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invite_code text not null unique,
  invite_link text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  assignee_name text not null,
  assignee_member_id uuid references public.household_members(id) on delete set null,
  due_label text not null,
  due_at timestamptz,
  xp_value integer not null default 0,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  mental_load_value integer not null default 1,
  proof_required boolean not null default false,
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly', 'weekdays')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'overdue')),
  created_by uuid references public.profiles(id) on delete set null,
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

create table if not exists public.task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_proofs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null,
  quantity text not null default '1 item',
  location text not null default 'pantry' check (location in ('fridge', 'freezer', 'pantry', 'bathroom', 'cleaning')),
  status text not null default 'missing' check (status in ('available', 'low', 'missing', 'purchased')),
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grocery_purchase_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  grocery_item_id uuid references public.grocery_items(id) on delete set null,
  name text not null,
  category text,
  purchased_at timestamptz not null default now(),
  store_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grocery_purchase_history
  drop constraint if exists grocery_purchase_history_store_id_fkey;
alter table public.grocery_purchase_history
  add constraint grocery_purchase_history_store_id_fkey
  foreign key (store_id) references public.stores(id) on delete set null;

create table if not exists public.store_recommendations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  title text not null,
  detail text not null,
  eta_minutes integer,
  item_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  category text not null default 'family' check (category in ('school', 'activity', 'appointment', 'family', 'routine')),
  date_label text not null,
  time_label text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  responsible_name text not null,
  responsible_member_id uuid references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Montreal',
  created_at timestamptz not null default now()
);

create table if not exists public.school_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  suppress_child_notifications boolean not null default true
);

create table if not exists public.mental_load_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete set null,
  category text not null,
  load_type text not null check (load_type in ('remembering', 'planning', 'scheduling', 'assigning', 'buying', 'doing', 'following_up')),
  weight integer not null default 1,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.mental_load_scores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.household_members(id) on delete cascade,
  score integer not null default 0,
  computed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general' check (category in ('tasks', 'groceries', 'events', 'rewards', 'ai', 'general')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  is_read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  rule_type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  cost integer not null default 0,
  approval_required boolean not null default true,
  assigned_member_id uuid references public.household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  role text not null check (role in ('admin', 'sidekick')),
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked', 'expired')),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  title text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'fulfilled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  note text,
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
  member_id uuid references public.household_members(id) on delete set null,
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
  participation_rate integer not null default 0,
  mental_load_balance integer not null default 0,
  momentum_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  target_xp integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_briefings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  briefing_type text not null default 'daily' check (briefing_type in ('daily', 'weekly')),
  title text not null,
  summary text not null,
  actions text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  detail text not null,
  tone text not null default 'blue',
  status text not null default 'active' check (status in ('active', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.smart_home_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  external_id text not null,
  name text not null,
  room text,
  device_type text not null,
  state jsonb not null default '{}'::jsonb,
  is_online boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, external_id)
);

create table if not exists public.smart_home_scenes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy alias view for older app code that referenced nova_briefings
create or replace view public.nova_briefings as
  select id, household_id, title, summary, actions, metadata, created_at, updated_at
  from public.ai_briefings
  where briefing_type = 'daily';

create index if not exists households_owner_id_idx on public.households(owner_id);
create index if not exists household_members_household_id_idx on public.household_members(household_id);
create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists household_invites_code_idx on public.household_invites(invite_code);
create index if not exists tasks_household_id_status_idx on public.tasks(household_id, status);
create index if not exists grocery_items_household_id_status_idx on public.grocery_items(household_id, status);
create index if not exists calendar_events_household_id_idx on public.calendar_events(household_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id, is_read);
create index if not exists reward_redemptions_household_id_idx on public.reward_redemptions(household_id, status);
create index if not exists ai_briefings_household_id_idx on public.ai_briefings(household_id, created_at desc);
create index if not exists analytics_events_household_id_idx on public.analytics_events(household_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger households_set_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger household_members_set_updated_at before update on public.household_members
  for each row execute function public.set_updated_at();
create trigger household_invites_set_updated_at before update on public.household_invites
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger task_assignments_set_updated_at before update on public.task_assignments
  for each row execute function public.set_updated_at();
create trigger grocery_items_set_updated_at before update on public.grocery_items
  for each row execute function public.set_updated_at();
create trigger calendar_events_set_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();
create trigger rewards_set_updated_at before update on public.rewards
  for each row execute function public.set_updated_at();
create trigger reward_redemptions_set_updated_at before update on public.reward_redemptions
  for each row execute function public.set_updated_at();
create trigger badges_set_updated_at before update on public.badges
  for each row execute function public.set_updated_at();
create trigger ai_briefings_set_updated_at before update on public.ai_briefings
  for each row execute function public.set_updated_at();
create trigger notification_rules_set_updated_at before update on public.notification_rules
  for each row execute function public.set_updated_at();
create trigger smart_home_devices_set_updated_at before update on public.smart_home_devices
  for each row execute function public.set_updated_at();
create trigger push_tokens_set_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- Profile bootstrap on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    -- Email local-part fallback can be an Apple private-relay token; the app
    -- treats those as incomplete via isProfileNameComplete and forces a name step.
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'orbit'), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Account deletion helper (callable by the user)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_checklists enable row level security;
alter table public.task_proofs enable row level security;
alter table public.grocery_items enable row level security;
alter table public.grocery_purchase_history enable row level security;
alter table public.stores enable row level security;
alter table public.store_recommendations enable row level security;
alter table public.calendar_events enable row level security;
alter table public.event_assignments enable row level security;
alter table public.schools enable row level security;
alter table public.school_schedules enable row level security;
alter table public.mental_load_entries enable row level security;
alter table public.mental_load_scores enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_rules enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.household_scores enable row level security;
alter table public.challenges enable row level security;
alter table public.ai_briefings enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.analytics_events enable row level security;
alter table public.smart_home_devices enable row level security;
alter table public.smart_home_scenes enable row level security;
alter table public.push_tokens enable row level security;

-- Profiles
create policy profiles_select_own on public.profiles for select using (id = auth.uid());
create policy profiles_update_own on public.profiles for update using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid());

-- Households
create policy households_select on public.households for select
  using (public.is_household_member(id) or owner_id = auth.uid());
create policy households_insert on public.households for insert with check (owner_id = auth.uid());
create policy households_update on public.households for update using (public.is_household_admin(id));
create policy households_delete on public.households for delete using (owner_id = auth.uid());

-- Members
create policy members_select on public.household_members for select
  using (public.is_household_member(household_id) or user_id = auth.uid());
create policy members_insert on public.household_members for insert
  with check (public.is_household_admin(household_id) or user_id = auth.uid());
create policy members_update on public.household_members for update
  using (public.is_household_admin(household_id) or user_id = auth.uid());
create policy members_delete on public.household_members for delete
  using (public.is_household_admin(household_id));

-- Invites: admins manage; anyone authenticated can read by code via edge/join
create policy invites_select on public.household_invites for select
  using (public.is_household_member(household_id) or true);
create policy invites_insert on public.household_invites for insert
  with check (public.is_household_admin(household_id));
create policy invites_update on public.household_invites for update
  using (public.is_household_admin(household_id));

-- Generic household-scoped read/write for core domains
create policy tasks_all on public.tasks for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy task_assignments_all on public.task_assignments for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy task_checklists_all on public.task_checklists for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy task_proofs_all on public.task_proofs for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy groceries_all on public.grocery_items for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy grocery_history_all on public.grocery_purchase_history for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy stores_all on public.stores for all using (household_id is null or public.is_household_member(household_id))
  with check (household_id is null or public.is_household_member(household_id));
create policy store_recs_all on public.store_recommendations for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy events_all on public.calendar_events for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy event_assignments_all on public.event_assignments for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy schools_all on public.schools for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy school_schedules_all on public.school_schedules for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy mental_load_entries_all on public.mental_load_entries for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy mental_load_scores_all on public.mental_load_scores for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid() or public.is_household_member(household_id));
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert
  with check (public.is_household_member(household_id));
create policy notification_rules_all on public.notification_rules for all using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));
create policy rewards_all on public.rewards for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy redemptions_all on public.reward_redemptions for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy badges_all on public.badges for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy user_badges_all on public.user_badges for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy xp_all on public.xp_transactions for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy scores_all on public.household_scores for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy challenges_all on public.challenges for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy ai_briefings_all on public.ai_briefings for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy ai_recs_all on public.ai_recommendations for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy analytics_insert on public.analytics_events for insert
  with check (user_id = auth.uid() or public.is_household_member(household_id));
create policy analytics_select on public.analytics_events for select
  using (public.is_household_admin(household_id) or user_id = auth.uid());
create policy smart_devices_all on public.smart_home_devices for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy smart_scenes_all on public.smart_home_scenes for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy push_tokens_all on public.push_tokens for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime publication helpers (ignore errors if already added)
create table if not exists public.household_saved_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_key text not null,
  name text not null,
  kind text not null
    check (kind in (
      'home', 'work', 'school', 'shop', 'practice', 'family',
      'cafe', 'pickup', 'clothing', 'custom'
    )),
  address text not null default '',
  place_query text,
  lat double precision,
  lng double precision,
  emoji text,
  is_favorite boolean not null default false,
  pickup_item_names text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, client_key)
);

create index if not exists household_saved_places_household_id_idx
  on public.household_saved_places (household_id, sort_order);

alter table public.household_saved_places enable row level security;

drop policy if exists household_saved_places_all on public.household_saved_places;
create policy household_saved_places_all on public.household_saved_places
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop trigger if exists household_saved_places_set_updated_at on public.household_saved_places;
create trigger household_saved_places_set_updated_at
  before update on public.household_saved_places
  for each row execute function public.set_updated_at();

do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.grocery_items;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.calendar_events;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.reward_redemptions;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.household_scores;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.household_saved_places;
  exception when others then null;
  end;
end $$;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  client_key text not null,
  member_id text not null,
  member_name text not null default '',
  kind text not null check (kind in ('chat', 'voice', 'briefing')),
  model text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  usd numeric(10, 4) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (household_id, client_key)
);

create index if not exists ai_usage_events_household_occurred_idx
  on public.ai_usage_events (household_id, occurred_at);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_select on public.ai_usage_events;
create policy ai_usage_events_select on public.ai_usage_events for select
  using (public.is_household_member(household_id));

drop policy if exists ai_usage_events_insert on public.ai_usage_events;
create policy ai_usage_events_insert on public.ai_usage_events for insert
  with check (public.is_household_member(household_id));

-- Revision G RPCs (promote_member_to_admin, generate_member_invite,
-- redeem_member_invite, submit_reward_proposal, decide_reward_proposal,
-- enforce_admin_cap) live in
-- supabase/migrations/20260820200000_revision_g_sidekick.sql


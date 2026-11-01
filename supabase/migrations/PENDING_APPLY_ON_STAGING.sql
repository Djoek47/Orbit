-- Apply on Supabase staging if not already run (in order).
-- Verify with queries at the bottom.

-- 1) Join approval household toggle
alter table public.households
  add column if not exists join_approval_required boolean not null default true;

-- 2) Member planned tasks + profile code index (from 20260828010000_member_planned_tasks.sql)
-- Run full migration file if planned_task_library_ids column is missing.

-- 2b) Planned task frequencies (from 20260908090000_member_planned_task_frequencies.sql)
alter table if exists public.household_members
  add column if not exists planned_task_frequencies jsonb not null default '{}'::jsonb;

-- 3) Household soft delete (from 20260828120000_household_soft_delete.sql)
-- Run full migration file if deletion_scheduled_for column is missing.

-- 4) Per-member pre-approval
alter table public.household_members
  add column if not exists join_pre_approved boolean not null default false;

comment on column public.household_members.join_pre_approved is
  'When true, this member enters active immediately after accepting their invite.';

-- 5) Token top-ups (from 20260917040000_token_grants.sql) — user applies before consumable IAP
-- create table public.token_grants (...); see migration file.

-- 6) Activity log (from 20260925090000_activity_log.sql) — append-only notification
-- history + assistant error/report rows, admin-read RLS, triggers on notifications.
-- Run full migration file if public.activity_log is missing.

-- 7) Credits never expire + Cloud credit remaining inquiry
--    (from 20260930220000_credits_never_expire.sql) — RUN THE FULL FILE if the view is missing.
--    Creates household_credit_balance (credits_available / purchased / spent).
alter table public.token_grants drop constraint if exists token_grants_consumed_within_tokens;
alter table public.token_grants
  add constraint token_grants_consumed_within_tokens check (consumed <= tokens);

create or replace view public.household_credit_balance
  with (security_invoker = true)
as
  select
    household_id,
    sum(tokens - consumed)::integer as credits_available,
    sum(tokens)::integer            as credits_purchased,
    sum(consumed)::integer          as credits_spent,
    max(granted_at)                 as last_purchase_at
  from public.token_grants
  group by household_id;

grant select on public.household_credit_balance to authenticated, anon, service_role;

-- 8) Proof storage (from 20260924120000_task_proofs_storage.sql +
--    20260930120000_proof_pipeline_retention.sql) — task-proofs bucket must exist
--    for Sidekick / shared-device photo submit. Run those files if Storage upload
--    returns proof_bucket_missing.

-- Verify
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'households' and column_name = 'join_approval_required';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'household_members' and column_name = 'join_pre_approved';

select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'token_grants';

select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'activity_log';

-- Credit remaining inquiry (Cloud / SQL editor)
select table_name from information_schema.views
where table_schema = 'public' and table_name = 'household_credit_balance';

select household_id, credits_available, credits_purchased, credits_spent, last_purchase_at
from public.household_credit_balance
order by credits_available desc
limit 50;

-- Proof bucket present?
select id, public, file_size_limit from storage.buckets where id = 'task-proofs';

-- 8) Household deletion v2 (from 20261005140000_household_deletion_v2.sql)
--    30-day grace, admin/owner RPCs, reminder stage columns, immediate token,
--    purge_due_households cron. Run the FULL migration file if columns missing:
--      deletion_reminder_stage, deletion_reminders_opt_out, deletion_immediate_token
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'households'
  and column_name in (
    'deletion_reminder_stage',
    'deletion_reminders_opt_out',
    'deletion_immediate_token',
    'deletion_immediate_token_expires_at'
  );

-- 9) Household transfer QR (from 20261005150000_household_transfer.sql)
--    Run FULL file if household_transfer_tokens is missing.
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'household_transfer_tokens';

-- 9b) Transfer QR fix + security advisors (20261006062055_fix_gen_random_bytes_and_security_advisors.sql)
--     Applied on staging 2026-10-06: extensions.gen_random_bytes, anon revoke,
--     search_path locks, monitor_cron_cursor service policy.
--
-- BLOCKER before next TestFlight / App Store push (manual — not SQL):
--   Advisor auth_leaked_password_protection
--   Dashboard → Authentication → Password → enable Leaked password protection (HaveIBeenPwned)
--   Tracked in docs/make-v33-testflight-notes.md § Blockers
select pg_get_functiondef(p.oid) like '%extensions.gen_random_bytes%' as transfer_uses_ext
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_household_transfer_token';

-- 10) make-v32 CRITICAL RLS
--     If you already ran 20261006013743 and got:
--       ERROR: 42P01: relation "public.xp_ledger_entries" does not exist
--     → that means CRITICAL parts 1–5 likely applied; Revision D tables are missing (OK).
--     → RUN INSTEAD: 20261006014806_security_harden_rls_v32_safe.sql (idempotent repair + advisors)
--
--     Fresh staging: run BOTH files in order (13743 then 14806), or only 14806 after a failed 13743.
--     - invites_select: members only (no or true)
--     - members_insert: admin or bootstrap owner
--     - role/status lock trigger on household_members
--     - token_grants: drop client INSERT; consume-only UPDATE trigger
--     - generate_member_invite: admin gate
--     - RLS on optional tables only if they exist (xp_ledger etc. skipped when absent)
--     - nova_briefings → security_invoker; profiles policies use (select auth.uid())
--     Also redeploy Edge function: grant-token-pack (auth + admin check).

-- Verify invites are not world-readable
select polname, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy
where polrelid = 'public.household_invites'::regclass
  and polname = 'invites_select';

-- Verify token_grants has no authenticated INSERT policy
select polname, polcmd
from pg_policy
where polrelid = 'public.token_grants'::regclass;

-- Verify previously open tables have RLS
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'itineraries', 'itinerary_stops', 'task_templates',
    'xp_ledger_entries', 'streak_rescues', 'day_classifications',
    'recess_periods', 'crown_awards', 'monitor_cron_cursor'
  )
order by c.relname;

-- One row per household notice email (sidekick added, shared device, trial ending), so each is
-- sent once. Written only by the send-household-email edge function (service role).
create table if not exists public.household_email_log (
  id bigserial primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  sent_to text,
  sent_at timestamptz not null default now(),
  unique (household_id, key)
);
alter table public.household_email_log enable row level security;
-- No client policies.

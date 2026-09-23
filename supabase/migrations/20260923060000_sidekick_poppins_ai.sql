-- Sidekick Poppins AI — admin opt-in (default off).
alter table if exists public.households
  add column if not exists sidekick_poppins_ai boolean not null default false;

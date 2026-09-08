-- Persist Meritocracy/Equity + member capability gates on households.

alter table public.households
  add column if not exists reward_mode text not null default 'weighted'
    check (reward_mode in ('weighted', 'flat')),
  add column if not exists hygiene_rewarded boolean not null default false,
  add column if not exists hygiene_xp integer not null default 5
    check (hygiene_xp in (5, 10)),
  add column if not exists member_capabilities jsonb not null default '{}'::jsonb;

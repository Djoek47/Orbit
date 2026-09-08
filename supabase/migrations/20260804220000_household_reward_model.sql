-- Persist onboarding XP system (reward model) so Settings can change it on the fly.
-- Values mirror lib/rewards/reward-model.ts RewardModel.

alter table public.households
  add column if not exists reward_model text not null default 'full'
    check (reward_model in ('xp_only', 'allowance', 'xp_rewards', 'xp_allowance', 'full'));

comment on column public.households.reward_model is
  'XP system: which subsystems are on (xp / allowance / rewards). Distinct from reward_mode (Meritocracy/Equity).';

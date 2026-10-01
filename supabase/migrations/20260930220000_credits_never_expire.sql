-- Credits are a balance, not an allowance.
--
-- The month's 300 actions reset on the 1st. Credits bought on top never do: they sit in
-- token_grants until they are spent, however many months that takes. Nothing in the app
-- expires them, and this migration makes that a property of the table rather than a habit.

-- A grant can never be consumed past what was bought. Without this a bad write could make the
-- balance negative, which reads as "your credits vanished".
alter table public.token_grants drop constraint if exists token_grants_consumed_within_tokens;
alter table public.token_grants
  add constraint token_grants_consumed_within_tokens check (consumed <= tokens);

-- One row per household: what is banked, what has ever been bought, what has been used.
create or replace view public.household_credit_balance as
  select
    household_id,
    sum(tokens - consumed)::integer as credits_available,
    sum(tokens)::integer            as credits_purchased,
    sum(consumed)::integer          as credits_spent,
    max(granted_at)                 as last_purchase_at
  from public.token_grants
  group by household_id;

comment on view public.household_credit_balance is
  'Bought credits per household. These never expire — only the monthly action allowance resets.';

comment on column public.token_grants.granted_at is
  'When the pack was bought. Consumption is oldest-first; this is not an expiry date.';

-- Push tokens: one Expo token may belong to several hosted profiles on a shared device.
-- Last-writer-wins on unique(token) silently stole notifications from sibling kids.

alter table if exists public.push_tokens
  drop constraint if exists push_tokens_token_key;

-- NULLS NOT DISTINCT so admin rows (member_id IS NULL) still upsert cleanly on token.
alter table if exists public.push_tokens
  drop constraint if exists push_tokens_token_member_unique;

alter table if exists public.push_tokens
  add constraint push_tokens_token_member_unique
  unique nulls not distinct (token, member_id);

-- Member-scoped push tokens for Sidekick devices (profile-code auth, no JWT).

alter table if exists public.push_tokens
  add column if not exists member_id uuid references public.household_members(id) on delete cascade;

alter table if exists public.push_tokens
  alter column user_id drop not null;

create index if not exists push_tokens_member_id_idx on public.push_tokens(member_id);

-- Each token must belong to either an auth user or a household member.
alter table if exists public.push_tokens
  drop constraint if exists push_tokens_owner_check;

alter table if exists public.push_tokens
  add constraint push_tokens_owner_check
  check (
    (user_id is not null and member_id is null)
    or (user_id is null and member_id is not null)
  );

-- Sidekick registration uses service-role edge functions; auth users keep existing policy.
create policy push_tokens_member_read on public.push_tokens
  for select
  using (
    member_id is not null
    and exists (
      select 1
      from public.household_members hm
      where hm.id = push_tokens.member_id
        and hm.user_id = auth.uid()
    )
  );

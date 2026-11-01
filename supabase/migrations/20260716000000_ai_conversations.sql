-- Nova conversation memory + pending join preview

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_id_idx
  on public.ai_messages(conversation_id, created_at asc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conversations_select on public.ai_conversations for select
  using (user_id = auth.uid() and public.is_household_member(household_id));

create policy ai_conversations_insert on public.ai_conversations for insert
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy ai_conversations_update on public.ai_conversations for update
  using (user_id = auth.uid() and public.is_household_member(household_id));

create policy ai_messages_select on public.ai_messages for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy ai_messages_insert on public.ai_messages for insert
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Pending members: read household name + their own membership row
create policy households_select_pending on public.households for select
  using (
    public.is_household_member(id)
    or exists (
      select 1 from public.household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.status = 'pending'
    )
  );

create trigger ai_conversations_set_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

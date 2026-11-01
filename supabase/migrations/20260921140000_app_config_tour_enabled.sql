-- Global remote flags (tour kill switch, etc.). Readable by any signed-in user.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists app_config_select_authenticated on public.app_config;
create policy app_config_select_authenticated on public.app_config
  for select
  to authenticated
  using (true);

-- Service role / dashboard writes; no client write policy by design.

insert into public.app_config (key, value)
values ('tour_enabled', 'true'::jsonb)
on conflict (key) do nothing;

comment on table public.app_config is 'Remote kill switches and soft config for the mobile app.';

-- Append-only household activity log.
--
-- Answers "was this notification sent, and when did it land?" even after the
-- notification row is gone, and collects assistant errors / "you're wrong"
-- reports until a dedicated error log exists.
--
-- * notification_id is a plain uuid (no FK) so history survives deletes.
-- * Server-side facts (created / push sent / read / dismissed / deleted) are
--   written by SECURITY DEFINER triggers on public.notifications.
-- * Devices may only append receipts (received / opened) and assistant rows.
-- * Only household admins (owner / admin — co-parents) can read the log.
-- * No UPDATE / DELETE policies: rows are immutable for clients.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in (
    'notification_created',
    'notification_push_sent',
    'notification_received',
    'notification_opened',
    'notification_read',
    'notification_dismissed',
    'notification_deleted',
    'assistant_error',
    'assistant_report'
  )),
  notification_id uuid,
  member_id uuid,
  actor_user_id uuid,
  title text,
  body text,
  category text,
  device text,
  detail jsonb not null default '{}'::jsonb
);

comment on table public.activity_log is
  'Append-only household audit trail: notification lifecycle + assistant errors/reports. Admin read only.';
comment on column public.activity_log.notification_id is
  'Not a foreign key on purpose — the log must outlive a deleted notification.';

create index if not exists activity_log_household_created_idx
  on public.activity_log (household_id, created_at desc);
create index if not exists activity_log_notification_idx
  on public.activity_log (notification_id);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select_admin on public.activity_log;
create policy activity_log_select_admin on public.activity_log
  for select
  using (public.is_household_admin(household_id));

drop policy if exists activity_log_insert_member on public.activity_log;
create policy activity_log_insert_member on public.activity_log
  for insert
  with check (
    public.is_household_member(household_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
    and kind in (
      'notification_received',
      'notification_opened',
      'assistant_error',
      'assistant_report'
    )
  );

-- Deliberately no update / delete policies (append-only; service role bypasses RLS).

-- ── Notification lifecycle triggers ────────────────────────────────────────

create or replace function public.activity_log_write(
  p_household_id uuid,
  p_kind text,
  p_notification_id uuid,
  p_member_id uuid,
  p_title text,
  p_body text,
  p_category text,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (
    household_id, kind, notification_id, member_id, actor_user_id,
    title, body, category, detail
  ) values (
    p_household_id, p_kind, p_notification_id, p_member_id, auth.uid(),
    p_title, p_body, p_category, coalesce(p_detail, '{}'::jsonb)
  );
exception
  -- Household being deleted in the same statement (cascade): skip, never block.
  when foreign_key_violation then null;
end;
$$;

-- Trigger-only helper: clients must not be able to forge server-side facts.
revoke all on function public.activity_log_write(uuid, text, uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function public.activity_log_notification_member(p_data jsonb)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_ids jsonb := p_data -> 'audienceMemberIds';
begin
  if jsonb_typeof(v_ids) = 'array' and jsonb_array_length(v_ids) = 1 then
    begin
      return (v_ids ->> 0)::uuid;
    exception when others then
      return null;
    end;
  end if;
  return null;
end;
$$;

create or replace function public.activity_log_on_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.activity_log_write(
    new.household_id,
    'notification_created',
    new.id,
    public.activity_log_notification_member(new.data),
    new.title,
    new.body,
    new.category,
    jsonb_build_object(
      'recipient_user_id', new.user_id,
      'priority', new.priority,
      'audience_member_ids', coalesce(new.data -> 'audienceMemberIds', '[]'::jsonb),
      'audience_roles', coalesce(new.data -> 'audienceRoles', '[]'::jsonb),
      'kind', new.data -> 'kind',
      'scheduled_for', new.scheduled_for
    )
  );
  return new;
end;
$$;

create or replace function public.activity_log_on_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_dismissed jsonb := coalesce(old.data -> 'dismissedByMemberIds', '[]'::jsonb);
  v_new_dismissed jsonb := coalesce(new.data -> 'dismissedByMemberIds', '[]'::jsonb);
  v_member text;
begin
  if old.sent_at is null and new.sent_at is not null then
    perform public.activity_log_write(
      new.household_id, 'notification_push_sent', new.id,
      public.activity_log_notification_member(new.data),
      new.title, new.body, new.category,
      jsonb_build_object('sent_at', new.sent_at, 'source', 'sent_at')
    );
  end if;

  if coalesce(old.is_read, false) = false and new.is_read = true then
    perform public.activity_log_write(
      new.household_id, 'notification_read', new.id, null,
      new.title, new.body, new.category, '{}'::jsonb
    );
  end if;

  -- Per-member dismiss: data.dismissedByMemberIds grows.
  if jsonb_typeof(v_new_dismissed) = 'array' then
    for v_member in
      select value from jsonb_array_elements_text(v_new_dismissed)
    loop
      if jsonb_typeof(v_old_dismissed) <> 'array' or not (v_old_dismissed ? v_member) then
        perform public.activity_log_write(
          new.household_id, 'notification_dismissed', new.id,
          case when v_member ~* '^[0-9a-f-]{36}$' then v_member::uuid else null end,
          new.title, new.body, new.category,
          jsonb_build_object('dismissed_by_member_id', v_member)
        );
      end if;
    end loop;
  end if;

  -- Legacy whole-row dismiss flag (no member attached).
  if coalesce((old.data ->> 'dismissed')::boolean, false) = false
     and coalesce((new.data ->> 'dismissed')::boolean, false) = true then
    perform public.activity_log_write(
      new.household_id, 'notification_dismissed', new.id, null,
      new.title, new.body, new.category, jsonb_build_object('flag', 'dismissed')
    );
  end if;

  return new;
exception
  -- Malformed data jsonb must never block the notification update itself.
  when invalid_text_representation then return new;
end;
$$;

create or replace function public.activity_log_on_notification_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.activity_log_write(
    old.household_id,
    'notification_deleted',
    old.id,
    public.activity_log_notification_member(old.data),
    old.title,
    old.body,
    old.category,
    jsonb_build_object(
      'recipient_user_id', old.user_id,
      'was_read', old.is_read,
      'originally_created_at', old.created_at,
      'sent_at', old.sent_at,
      'audience_member_ids', coalesce(old.data -> 'audienceMemberIds', '[]'::jsonb),
      'dismissed_by_member_ids', coalesce(old.data -> 'dismissedByMemberIds', '[]'::jsonb),
      'kind', old.data -> 'kind',
      'task_id', old.data -> 'taskId'
    )
  );
  return old;
end;
$$;

drop trigger if exists activity_log_notification_insert on public.notifications;
create trigger activity_log_notification_insert
  after insert on public.notifications
  for each row execute function public.activity_log_on_notification_insert();

drop trigger if exists activity_log_notification_update on public.notifications;
create trigger activity_log_notification_update
  after update on public.notifications
  for each row execute function public.activity_log_on_notification_update();

drop trigger if exists activity_log_notification_delete on public.notifications;
create trigger activity_log_notification_delete
  after delete on public.notifications
  for each row execute function public.activity_log_on_notification_delete();

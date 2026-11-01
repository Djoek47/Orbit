-- Proof photos: ensure Storage bucket, 30-day retention mirror, activity log keeps proofUri.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-proofs',
  'task-proofs',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.task_proofs
  add column if not exists expires_at timestamptz;

update public.task_proofs
set expires_at = created_at + interval '30 days'
where expires_at is null;

alter table public.task_proofs
  alter column expires_at set default (now() + interval '30 days');

create index if not exists task_proofs_expires_at_idx
  on public.task_proofs (expires_at);

comment on column public.task_proofs.expires_at is
  'Proof photos are retained about 30 days for admin review / activity history.';

-- Copy proofUri + taskId into activity_log detail when a notification is created.
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
    jsonb_strip_nulls(
      jsonb_build_object(
        'recipient_user_id', new.user_id,
        'priority', new.priority,
        'audience_member_ids', coalesce(new.data -> 'audienceMemberIds', '[]'::jsonb),
        'audience_roles', coalesce(new.data -> 'audienceRoles', '[]'::jsonb),
        'kind', new.data -> 'kind',
        'scheduled_for', new.scheduled_for,
        'taskId', new.data -> 'taskId',
        'proofUri', coalesce(new.data -> 'proofUri', new.data -> 'proof_uri'),
        'memberName', new.data -> 'memberName',
        'task', new.data -> 'task'
      )
    )
  );
  return new;
end;
$$;

-- Durable proof photos: household-scoped public bucket so admins can load
-- Sidekick submissions from any device (file:// URIs only work on the capturer).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-proofs',
  'task-proofs',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {household_id}/{task_id}/{timestamp}.ext
create or replace function public.storage_proof_household_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  part text := split_part(object_name, '/', 1);
begin
  if part is null or part !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return part::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists "task_proofs_select_member" on storage.objects;
create policy "task_proofs_select_member"
  on storage.objects for select
  using (
    bucket_id = 'task-proofs'
    and public.storage_proof_household_id(name) is not null
    and public.is_household_member(public.storage_proof_household_id(name))
  );

drop policy if exists "task_proofs_insert_member" on storage.objects;
create policy "task_proofs_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'task-proofs'
    and public.storage_proof_household_id(name) is not null
    and public.is_household_member(public.storage_proof_household_id(name))
  );

drop policy if exists "task_proofs_update_member" on storage.objects;
create policy "task_proofs_update_member"
  on storage.objects for update
  using (
    bucket_id = 'task-proofs'
    and public.storage_proof_household_id(name) is not null
    and public.is_household_member(public.storage_proof_household_id(name))
  );

drop policy if exists "task_proofs_delete_admin" on storage.objects;
create policy "task_proofs_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'task-proofs'
    and public.storage_proof_household_id(name) is not null
    and public.is_household_admin(public.storage_proof_household_id(name))
  );

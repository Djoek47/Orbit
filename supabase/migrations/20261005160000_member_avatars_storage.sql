-- Durable member avatars (Image Playground + Photos). Public bucket so any
-- household device can load the https URL stored on household_members.avatar_symbol.
-- Local file:// copies in documents/avatars/ are wiped when the app is deleted.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {household_id}/{member_id}/{timestamp}.ext
create or replace function public.storage_avatar_household_id(object_name text)
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

drop policy if exists "member_avatars_select_member" on storage.objects;
create policy "member_avatars_select_member"
  on storage.objects for select
  using (
    bucket_id = 'member-avatars'
    and public.storage_avatar_household_id(name) is not null
    and public.is_household_member(public.storage_avatar_household_id(name))
  );

drop policy if exists "member_avatars_insert_member" on storage.objects;
create policy "member_avatars_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'member-avatars'
    and public.storage_avatar_household_id(name) is not null
    and public.is_household_member(public.storage_avatar_household_id(name))
  );

drop policy if exists "member_avatars_update_member" on storage.objects;
create policy "member_avatars_update_member"
  on storage.objects for update
  using (
    bucket_id = 'member-avatars'
    and public.storage_avatar_household_id(name) is not null
    and public.is_household_member(public.storage_avatar_household_id(name))
  );

drop policy if exists "member_avatars_delete_admin" on storage.objects;
create policy "member_avatars_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'member-avatars'
    and public.storage_avatar_household_id(name) is not null
    and public.is_household_admin(public.storage_avatar_household_id(name))
  );

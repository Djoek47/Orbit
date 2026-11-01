-- Support feedback screenshots — private per-user paths, 7-day signed URLs from the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-uploads',
  'support-uploads',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {auth.uid()}/{filename}
drop policy if exists "support_uploads_select_own" on storage.objects;
create policy "support_uploads_select_own"
  on storage.objects for select
  using (
    bucket_id = 'support-uploads'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "support_uploads_insert_own" on storage.objects;
create policy "support_uploads_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'support-uploads'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "support_uploads_delete_own" on storage.objects;
create policy "support_uploads_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'support-uploads'
    and auth.uid()::text = split_part(name, '/', 1)
  );

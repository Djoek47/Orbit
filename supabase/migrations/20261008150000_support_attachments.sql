-- Screenshots attached to in-app support requests, readable by console staff only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 10485760,
        array['image/jpeg','image/png','image/heic','image/webp'])
on conflict (id) do nothing;

drop policy if exists "console staff read support attachments" on storage.objects;
create policy "console staff read support attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments' and public.is_console_staff());

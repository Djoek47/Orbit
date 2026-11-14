-- Names in Supabase's Users list.
-- The app stored names only on public.profiles, so the dashboard (and anyone matching an
-- account by eye) saw bare emails — for Sign in with Apple, a privaterelay address. The app
-- now also writes the name into the account's metadata; this fills it in for existing people.

update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
       || jsonb_build_object('full_name', p.display_name, 'name', p.display_name, 'display_name', p.display_name)
  from public.profiles p
 where p.id = u.id
   and coalesce(trim(p.display_name), '') <> ''
   and coalesce(u.raw_user_meta_data->>'full_name', '') = '';

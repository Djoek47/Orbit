-- Allow household members (admin / co-admin / linked members) to update
-- notifications in their household so dismiss + mark-read work when
-- user_id is null or belongs to another member.
-- Sidekick devices without JWT use sidekick-notification-action (service role).

drop policy if exists notifications_update on public.notifications;

create policy notifications_update on public.notifications
  for update
  using (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  )
  with check (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  );

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type NotifyInput = {
  householdId: string;
  title: string;
  body: string;
  category: string;
  priority?: string;
  data?: Record<string, unknown>;
};

export async function adminMemberIds(admin: SupabaseClient, householdId: string): Promise<string[]> {
  const { data } = await admin
    .from('household_members')
    .select('id, role, status')
    .eq('household_id', householdId)
    .eq('status', 'active');
  return (data ?? [])
    .filter((row) => row.role === 'owner' || row.role === 'admin')
    .map((row) => row.id as string);
}

export async function notifyAdminsAndPush(
  admin: SupabaseClient,
  input: NotifyInput
): Promise<string | null> {
  const memberIds = await adminMemberIds(admin, input.householdId);
  if (!memberIds.length) return null;

  const data = {
    ...(input.data ?? {}),
    audienceMemberIds: memberIds,
  };

  const { data: row, error } = await admin
    .from('notifications')
    .insert({
      household_id: input.householdId,
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority ?? 'medium',
      data,
      is_read: false,
    })
    .select('id')
    .single();

  if (error || !row?.id) {
    console.warn('sidekick-notify insert failed', error?.message);
    return null;
  }

  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    await fetch(`${supabaseUrl}/functions/v1/dispatch-member-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        ...(accessToken ? { 'x-expo-access-token': accessToken } : {}),
      },
      body: JSON.stringify({ notificationId: row.id }),
    });
  } catch (pushError) {
    console.warn('sidekick-notify push failed', pushError);
  }

  return row.id as string;
}

import { Platform } from 'react-native';

import { dataMode } from '@/config/data-mode';
import { getExpoPushToken, requestNotificationPermission } from '@/lib/notifications/push-token';
import { getSupabaseClient } from '@/lib/supabase/client';

/** Register Expo push token for Sidekick profile-code devices via edge function. */
export async function registerSidekickPushNotifications(profileInviteCode: string): Promise<string | null> {
  if (dataMode !== 'supabase') return null;

  const token = await getExpoPushToken();
  if (!token) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase.functions.invoke('register-sidekick-push', {
    body: {
      code: profileInviteCode,
      token,
      platform: Platform.OS,
    },
  });

  if (error) {
    console.warn('registerSidekickPushNotifications', error.message);
    return null;
  }

  return token;
}

/** Fire-and-forget remote push to audience members after an inbox row is persisted. */
export function dispatchMemberPush(notificationId: string): void {
  if (dataMode !== 'supabase') return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  void supabase.functions
    .invoke('dispatch-member-push', { body: { notificationId } })
    .then(({ error }) => {
      if (error) console.warn('dispatchMemberPush', error.message);
    })
    .catch((error) => {
      console.warn('dispatchMemberPush', error);
    });
}

/** Register push for the current actor — auth user or Sidekick profile code. */
export async function registerPushForActor(input: {
  userId?: string | null;
  profileInviteCode?: string | null;
}): Promise<string | null> {
  if (input.profileInviteCode?.trim()) {
    return registerSidekickPushNotifications(input.profileInviteCode);
  }
  const { registerForPushNotifications } = await import('@/lib/notifications/push');
  return registerForPushNotifications(input.userId ?? null);
}

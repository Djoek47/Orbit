import { Platform } from 'react-native';

import { dataMode } from '@/config/data-mode';
import { getExpoPushToken } from '@/lib/notifications/push-token';
import { getSupabaseClient } from '@/lib/supabase/client';

/** Register Expo push token for Sidekick profile-code devices via edge function. */
export async function registerSidekickPushNotifications(profileInviteCode: string): Promise<string | null> {
  if (dataMode !== 'supabase') return null;

  const { registerIuiActNotificationCategory } = await import(
    '@/lib/notifications/iui-act-category'
  );
  await registerIuiActNotificationCategory();

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

/**
 * Dispatch an IUI act as Approve/Change notification.
 * Supabase mode → edge push with categoryId; mock/Expo Go → local banner.
 */
export function dispatchIuiActNotification(input: {
  beat: import('@/lib/poppins/ui-scenes').IuiBeat;
  householdId: string;
  audienceMemberIds: string[];
  recipientName?: string;
}): void {
  void (async () => {
    const { getSessionNotificationActions } = await import('@/lib/poppins/session-act-mode');
    const withActions = getSessionNotificationActions();
    const { IUI_ACT_CATEGORY } = await import('@/lib/notifications/iui-act-category');
    const { presentLocalBanner } = await import('@/lib/notifications/push');
    const { serializeIuiActNotification } = await import(
      '@/lib/poppins/iui-act-notification'
    );

    const serialized = serializeIuiActNotification({
      beat: input.beat,
      householdId: input.householdId,
      recipientName: input.recipientName,
    });

    if (dataMode !== 'supabase') {
      await presentLocalBanner(
        serialized.title,
        serialized.body,
        serialized.data as unknown as Record<string, unknown>,
        withActions ? { categoryIdentifier: IUI_ACT_CATEGORY } : undefined
      );
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase.functions.invoke('dispatch-member-push', {
      body: {
        title: serialized.title,
        body: serialized.body,
        audienceMemberIds: input.audienceMemberIds,
        ...(withActions ? { categoryId: IUI_ACT_CATEGORY } : {}),
        data: serialized.data,
      },
    });
    if (error) console.warn('dispatchIuiActNotification', error.message);
  })().catch((error) => {
    console.warn('dispatchIuiActNotification', error);
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

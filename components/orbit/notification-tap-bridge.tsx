import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { getNotificationRoute } from '@/lib/notifications/navigate';
import type { NotificationItem } from '@/types/orbit';

function routeFromPushData(data: Record<string, unknown>): string | null {
  const taskId = typeof data.taskId === 'string' ? data.taskId : null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : null;
  const category =
    typeof data.category === 'string' ? (data.category as NotificationItem['category']) : 'general';
  const kind = typeof data.kind === 'string' ? data.kind : null;
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;

  return getNotificationRoute({
    id: typeof data.notificationId === 'string' ? data.notificationId : 'push',
    householdId: '',
    title: '',
    body: '',
    category,
    priority: 'medium',
    isRead: false,
    createdAt: new Date().toISOString(),
    data: {
      ...data,
      taskId,
      eventId,
      kind,
      notificationId,
    },
  });
}

/** Deep-link when user taps an OS push notification. */
export function NotificationTapBridge() {
  useEffect(() => {
    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const route = routeFromPushData(data as Record<string, unknown>);
      if (route) {
        router.push(route as never);
      }
    };

    void Notifications.getLastNotificationResponseAsync().then(navigateFromResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromResponse);
    return () => subscription.remove();
  }, []);

  return null;
}

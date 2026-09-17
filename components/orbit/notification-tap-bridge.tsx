import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { handleIuiActNotificationResponse } from '@/lib/notifications/iui-act-response';
import { getNotificationRoute } from '@/lib/notifications/navigate';
import { useOrbit } from '@/store/orbit-store';
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

/** Deep-link when user taps an OS push notification (incl. IUI Approve / Change). */
export function NotificationTapBridge() {
  const {
    household,
    currentMember,
    createTask,
    createEvent,
    createItinerary,
    addMissingGrocery,
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
    recordPoppinsUsage,
  } = useOrbit();

  const writesRef = useRef({
    household,
    currentMember,
    createTask,
    createEvent,
    createItinerary,
    addMissingGrocery,
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
  });
  writesRef.current = {
    household,
    currentMember,
    createTask,
    createEvent,
    createItinerary,
    addMissingGrocery,
    completeTask,
    updateTask,
    claimReward,
    advanceItineraryStop,
  };

  const chargeRef = useRef(recordPoppinsUsage);
  chargeRef.current = recordPoppinsUsage;

  useEffect(() => {
    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const payload = data as Record<string, unknown>;

      void (async () => {
        const result = await handleIuiActNotificationResponse({
          actionIdentifier: response.actionIdentifier,
          data: payload,
          writes: writesRef.current,
          defaultActionId: Notifications.DEFAULT_ACTION_IDENTIFIER,
          onApproved: async () => {
            await chargeRef.current('notify', {
              question: 'iui_act_approve',
              answer: String(payload.titleLine ?? 'approved'),
              usage: { inputTokens: 0, outputTokens: 0, model: 'iui-act', usd: 0 },
              mode: 'silent',
              chargeAct: true,
              tokens: 1,
            });
          },
        });
        if (result.handled) return;

        const route = routeFromPushData(payload);
        if (route) {
          router.push(route as never);
        }
      })();
    };

    void Notifications.getLastNotificationResponseAsync().then(navigateFromResponse);

    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromResponse);
    return () => subscription.remove();
  }, []);

  return null;
}

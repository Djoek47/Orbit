import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { logActivity, type ActivityKind } from '@/lib/activity/activity-log';
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

function deviceLabel(): string {
  return [Platform.OS, Device.modelName].filter(Boolean).join(' · ');
}

/** dispatch-member-push puts the inbox row id in `data.notificationId`. */
function notificationIdFromPush(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const id = (data as Record<string, unknown>).notificationId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Activity-log receipt (received / opened) for an OS push. Deduped per push + kind. */
function logPushReceipt(
  kind: Extract<ActivityKind, 'notification_received' | 'notification_opened'>,
  notification: Notifications.Notification,
  context: { householdId?: string | null; memberId?: string | null },
  detail: Record<string, unknown> = {}
) {
  const content = notification.request.content;
  const notificationId = notificationIdFromPush(content.data);
  const payload = content.data as Record<string, unknown> | null | undefined;
  const householdId =
    typeof payload?.householdId === 'string' ? payload.householdId : context.householdId;
  if (!notificationId || !householdId) return;
  void logActivity({
    householdId,
    kind,
    notificationId,
    memberId: context.memberId ?? null,
    title: content.title ?? null,
    body: content.body ?? null,
    category: typeof payload?.category === 'string' ? payload.category : null,
    device: deviceLabel(),
    detail: {
      pushIdentifier: notification.request.identifier,
      deliveredAt: new Date(notification.date).toISOString(),
      ...detail,
    },
    dedupeKey: `${kind}:${notification.request.identifier}`,
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

  useEffect(() => {
    const receiptContext = () => ({
      householdId: writesRef.current.household?.id,
      memberId: writesRef.current.currentMember?.id,
    });

    const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      // Opening implies receipt (background pushes never hit the received listener).
      logPushReceipt('notification_received', response.notification, receiptContext(), {
        via: 'tap',
      });
      logPushReceipt('notification_opened', response.notification, receiptContext(), {
        action: response.actionIdentifier,
      });
      const data = response.notification.request.content.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const payload = data as Record<string, unknown>;

      void (async () => {
        const result = await handleIuiActNotificationResponse({
          actionIdentifier: response.actionIdentifier,
          data: payload,
          writes: writesRef.current,
          defaultActionId: Notifications.DEFAULT_ACTION_IDENTIFIER,
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

    // Foreground delivery.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      logPushReceipt('notification_received', notification, receiptContext(), { via: 'foreground' });
    });

    // Delivered while backgrounded and still sitting in Notification Center.
    const logPresented = () => {
      void Notifications.getPresentedNotificationsAsync()
        .then((presented) => {
          for (const notification of presented) {
            logPushReceipt('notification_received', notification, receiptContext(), { via: 'tray' });
          }
        })
        .catch(() => {});
    };
    logPresented();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') logPresented();
    });

    return () => {
      subscription.remove();
      received.remove();
      appState.remove();
    };
  }, []);

  return null;
}

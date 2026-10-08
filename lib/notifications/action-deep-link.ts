/**
 * B3 — Notification action deep links (approve / proof / reward).
 * Thin wrapper over `getNotificationRoute` for payload-only callers + tests.
 */
import { getNotificationRoute } from '@/lib/notifications/navigate';
import type { NotificationItem } from '@/types/orbit';

export type NotificationActionTarget = {
  pathname: string;
  params?: Record<string, string>;
};

export function resolveNotificationAction(
  data: Record<string, unknown> | null | undefined,
  category: NotificationItem['category'] = 'general'
): NotificationActionTarget | null {
  const route = getNotificationRoute({
    id: 'tmp',
    householdId: 'tmp',
    title: '',
    body: '',
    category,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: data ?? undefined,
  } as NotificationItem);
  if (!route) return null;
  const taskMatch = route.match(/^\/task\/([^/]+)$/);
  if (taskMatch) {
    return { pathname: '/task/[id]', params: { id: taskMatch[1] } };
  }
  return { pathname: route };
}

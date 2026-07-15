import type { NotificationItem } from '@/types/orbit';

/** Resolve an in-app route from a notification's category / data payload. */
export function getNotificationRoute(item: NotificationItem): string | null {
  const data = item.data ?? {};
  const taskId = typeof data.taskId === 'string' ? data.taskId : null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : null;
  const groceryId = typeof data.groceryId === 'string' ? data.groceryId : null;

  if (item.category === 'tasks' && taskId) {
    return `/task/${taskId}`;
  }
  if (item.category === 'events' && eventId) {
    return `/event/${eventId}`;
  }
  if (item.category === 'groceries') {
    return groceryId ? '/(tabs)/groceries' : '/(tabs)/groceries';
  }
  if (item.category === 'rewards') {
    return '/(tabs)/rewards';
  }
  if (item.category === 'ai') {
    return '/(tabs)/nova';
  }
  if (item.category === 'events') {
    return '/(tabs)/calendar';
  }
  if (item.category === 'tasks') {
    return '/(tabs)/tasks';
  }
  return null;
}

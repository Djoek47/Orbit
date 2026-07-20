import type { NotificationItem } from '@/types/orbit';

/** Resolve an in-app route from a notification's category / data payload. */
export function getNotificationRoute(item: NotificationItem): string | null {
  const data = item.data ?? {};
  const taskId = typeof data.taskId === 'string' ? data.taskId : null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : null;
  const groceryId = typeof data.groceryId === 'string' ? data.groceryId : null;
  const itineraryId = typeof data.itineraryId === 'string' ? data.itineraryId : null;
  const kind = typeof data.kind === 'string' ? data.kind : null;

  if (itineraryId) {
    return `/itinerary/${itineraryId}`;
  }
  if (kind === 'itinerary_leg') {
    return '/(tabs)/plan';
  }
  if ((item.category === 'tasks' || item.category === 'ai') && taskId) {
    return `/task/${taskId}`;
  }
  if (kind === 'proof_submitted' || kind === 'proof_approved') {
    return taskId ? `/task/${taskId}` : '/(tabs)/tasks';
  }
  if (item.category === 'events' && eventId) {
    return `/event/${eventId}`;
  }
  if (item.category === 'groceries' || kind === 'grocery_added') {
    return groceryId ? '/(tabs)/groceries' : '/(tabs)/groceries';
  }
  if (item.category === 'rewards' || kind?.startsWith('reward_')) {
    return '/(tabs)/rewards';
  }
  if (kind === 'join_pending') {
    return '/household-members';
  }
  if (item.category === 'ai') {
    return '/(tabs)/nova';
  }
  if (item.category === 'events') {
    return '/(tabs)/plan';
  }
  if (item.category === 'tasks') {
    return '/(tabs)/tasks';
  }
  return null;
}

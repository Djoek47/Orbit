import type { NotificationItem } from '@/types/orbit';

/** Resolve an in-app route from a notification's category / data payload (B3 actions). */
export function getNotificationRoute(item: NotificationItem): string | null {
  const data = item.data ?? {};
  const taskId = typeof data.taskId === 'string' ? data.taskId : null;
  const eventId = typeof data.eventId === 'string' ? data.eventId : null;
  const itineraryId = typeof data.itineraryId === 'string' ? data.itineraryId : null;
  const kind = typeof data.kind === 'string' ? data.kind : null;
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;

  if (itineraryId) {
    return `/itinerary/${itineraryId}`;
  }
  if (kind === 'itinerary_leg') {
    return '/(tabs)/plan';
  }
  if (kind === 'proof_requested' || kind === 'proof_submitted' || kind === 'proof_approved' || notificationId === 'N19' || notificationId === 'N20') {
    return taskId ? `/task/${taskId}` : '/(tabs)/tasks';
  }
  if ((item.category === 'tasks' || item.category === 'ai') && taskId) {
    return `/task/${taskId}`;
  }
  if (item.category === 'events' && eventId) {
    return `/event/${eventId}`;
  }
  if (item.category === 'groceries' || kind === 'grocery_added' || kind === 'near_shop_deal') {
    return '/shopping-mode';
  }
  if (kind?.includes('allowance') || notificationId === 'N24') {
    return '/allowance-history';
  }
  if (item.category === 'rewards' || kind?.startsWith('reward_') || notificationId === 'N26' || notificationId === 'N27') {
    return '/(tabs)/rewards';
  }
  if (kind === 'join_pending') {
    return '/household-members';
  }
  if (item.category === 'ai') {
    return '/(tabs)/poppins';
  }
  if (item.category === 'events') {
    return '/(tabs)/plan';
  }
  if (item.category === 'tasks') {
    return '/(tabs)/tasks';
  }
  return null;
}

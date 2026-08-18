import {
  isDismissedNotification,
  isJunkMockInsight,
  isSameLocalDay,
} from '@/lib/ai/daily-insight';
import type { NotificationItem } from '@/types/orbit';

function isInsightRow(item: NotificationItem): boolean {
  const kind = typeof item.data?.kind === 'string' ? item.data.kind : '';
  const urgency = typeof item.data?.urgency === 'string' ? item.data.urgency : '';
  if (urgency === 'insight' || item.data?.aiGenerated === true) return true;
  return (
    kind === 'grocery_need' ||
    kind === 'plan_gap' ||
    kind === 'overdue_work' ||
    kind === 'streak_risk' ||
    kind.includes('insight') ||
    kind.includes('pattern')
  );
}

/** Rows the bell sheet may show (Insights = today's unread only, never junk or dismissed). */
export function isInboxSheetItem(item: NotificationItem, now = Date.now()): boolean {
  if (isDismissedNotification(item) || isJunkMockInsight(item)) return false;
  if (isInsightRow(item)) {
    return !item.isRead && isSameLocalDay(item.createdAt, now);
  }
  return true;
}

export function unreadInboxCount(items: NotificationItem[], now = Date.now()): number {
  return items.filter((item) => !item.isRead && isInboxSheetItem(item, now)).length;
}

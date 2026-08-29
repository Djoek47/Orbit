import { isSameLocalDay } from '@/lib/ai/daily-insight';
import { getNotificationRoute } from '@/lib/notifications/navigate';
import { isInboxSheetItem } from '@/lib/poppins/inbox-visibility';
import { foldGlanceNotifications, laneForKind } from '@/lib/poppins/notification-policy';
import { stripExampleCopy } from '@/lib/trophies/display-name';
import type { PoppinsBriefing, NotificationItem } from '@/types/orbit';

export type NotifBucket = 'critical' | 'urgent' | 'insight' | 'done';

export type SheetNotificationCard = {
  id: string;
  bucket: NotifBucket;
  title: string;
  body?: string;
  bullets?: string[];
  timeLabel: string;
  color: string;
  actionLabel?: string;
  /** In-app route for synthetic cards that have no `source` notification. */
  actionRoute?: string;
  memberEmoji?: string;
  source?: NotificationItem;
};

export const BUCKET_ORDER: NotifBucket[] = ['critical', 'urgent', 'insight', 'done'];

export const BUCKET_LABELS: Record<NotifBucket, string> = {
  critical: 'Needs Action',
  urgent: 'Today',
  insight: 'Insights',
  done: 'Completed',
};

export const BUCKET_COLORS: Record<NotifBucket, string> = {
  critical: '#F87171',
  urgent: '#FB923C',
  insight: '#38BDF8',
  done: '#34D399',
};

function isSameDay(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function formatRelative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function memberEmojiFrom(item: NotificationItem): string | undefined {
  const data = item.data ?? {};
  if (typeof data.memberEmoji === 'string') return data.memberEmoji;
  if (item.category === 'tasks') return '✅';
  if (item.category === 'rewards') return '🎁';
  if (item.category === 'events') return '📅';
  if (item.category === 'groceries') return '🛒';
  if (item.category === 'ai') return '🤖';
  return undefined;
}

function actionLabelFor(item: NotificationItem): string | undefined {
  const kind = typeof item.data?.kind === 'string' ? item.data.kind : '';
  const cta = typeof item.data?.cta === 'string' ? item.data.cta : '';
  if (cta) return cta;
  if (item.category === 'rewards' || kind.startsWith('reward_')) return 'Open Rewards';
  if (kind === 'trophy_unlocked' || kind === 'glance' || kind === 'task_completed') return 'View';
  if (item.category === 'tasks' || kind.includes('proof')) return 'Open Task';
  if (item.category === 'events') return 'Open Plan';
  if (item.category === 'groceries') return 'Open Groceries';
  if (item.category === 'ai') return 'Ask Poppins';
  return 'View';
}

/** Presentation-only bucketing — composer urgency wins; trophies never Needs Action. */
export function bucketNotification(item: NotificationItem): NotifBucket {
  const kind = typeof item.data?.kind === 'string' ? item.data.kind : '';
  const urgency = typeof item.data?.urgency === 'string' ? item.data.urgency : '';
  const lane = laneForKind(kind);

  if (item.isRead) {
    if (kind.includes('complete') || kind.includes('approved') || item.category === 'tasks') {
      return 'done';
    }
    return urgency === 'insight' || item.category === 'ai' ? 'insight' : 'done';
  }

  if (urgency === 'needs_action' || lane === 'interrupt') {
    return 'critical';
  }
  if (urgency === 'insight' || lane === 'insight') {
    return 'insight';
  }
  if (
    urgency === 'today' ||
    lane === 'glance' ||
    kind === 'glance' ||
    kind === 'trophy_unlocked' ||
    kind === 'task_completed'
  ) {
    return 'urgent';
  }
  if (kind.includes('complete') || kind.includes('approved')) {
    return 'done';
  }
  if (item.priority === 'critical') {
    return 'critical';
  }
  if (item.category === 'ai' || kind.includes('insight') || kind.includes('pattern')) {
    return 'insight';
  }
  if (!item.isRead || isSameDay(item.createdAt)) {
    return 'urgent';
  }
  return 'done';
}

export function buildSheetNotifications(
  notifications: NotificationItem[],
  briefing?: PoppinsBriefing | null,
  now = Date.now(),
  options?: { hidePoppinsLaunch?: boolean }
): SheetNotificationCard[] {
  const cards: SheetNotificationCard[] = [];
  const hideLaunch = options?.hidePoppinsLaunch === true;

  if (briefing?.summary) {
    const fromActions = (briefing.actions ?? []).filter(Boolean).slice(0, 4);
    const digestBullets =
      fromActions.length > 0
        ? fromActions
        : briefing.summary
            .split(/[.;]\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4);
    cards.push({
      id: 'morning-brief',
      bucket: 'urgent',
      title: briefing.title || 'Morning Briefing',
      bullets: digestBullets.length ? digestBullets : [briefing.summary],
      timeLabel: 'Today',
      color: BUCKET_COLORS.urgent,
      actionLabel: hideLaunch ? undefined : 'View Home',
      actionRoute: hideLaunch ? undefined : '/(tabs)',
    });
  }

  const sorted = foldGlanceNotifications(
    [...notifications]
      .filter((item) => isInboxSheetItem(item, now))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  let insightCount = 0;
  for (const item of sorted.slice(0, 40)) {
    const bucket = bucketNotification(item);
    if (bucket === 'insight') {
      if (item.isRead || !isSameLocalDay(item.createdAt, now)) continue;
      if (insightCount >= 3) continue;
      insightCount += 1;
    }
    cards.push({
      id: item.id,
      bucket,
      title: stripExampleCopy(item.title),
      body: item.body ? stripExampleCopy(item.body) : undefined,
      timeLabel: formatRelative(item.createdAt),
      color: BUCKET_COLORS[bucket],
      actionLabel: actionLabelFor(item),
      memberEmoji: memberEmojiFrom(item),
      source: item,
    });
  }

  return cards;
}

export function needsAttentionCount(cards: SheetNotificationCard[]) {
  return cards.filter((c) => c.bucket !== 'done' && (!c.source || !c.source.isRead)).length;
}

/** Route the inbox CTA should open. */
export function routeForSheetCard(card: SheetNotificationCard): string | null {
  if (card.actionRoute) return card.actionRoute;
  if (card.source) return getNotificationRoute(card.source);
  return null;
}

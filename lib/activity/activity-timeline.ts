/**
 * Pure presentation helpers for the admin activity log (no React Native imports).
 */
import type { ActivityEntry, ActivityKind } from '@/lib/activity/activity-log';

export type ActivityTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type ActivityNames = {
  memberName: (memberId: string) => string | null;
  userName: (userId: string) => string | null;
};

export type DescribedActivity = {
  label: string;
  sublabel: string | null;
  /** MaterialIcons glyph name. */
  icon: string;
  tone: ActivityTone;
};

export type NotificationActivitySummary = {
  notificationId: string;
  title: string;
  body: string | null;
  category: string | null;
  firstAt: string;
  lastAt: string;
  entryCount: number;
  sent: boolean;
  received: boolean;
  opened: boolean;
  read: boolean;
  dismissed: boolean;
  deleted: boolean;
};

/** Lifecycle order used to break timestamp ties in a timeline. */
const KIND_ORDER: Record<ActivityKind, number> = {
  notification_created: 0,
  notification_push_sent: 1,
  notification_received: 2,
  notification_opened: 3,
  notification_read: 4,
  notification_dismissed: 5,
  notification_deleted: 6,
  assistant_error: 7,
  assistant_report: 8,
};

/** One notification's history, oldest first (Created → … → Deleted). */
export function timelineForNotification(
  entries: readonly ActivityEntry[],
  notificationId: string
): ActivityEntry[] {
  return entries
    .filter((entry) => entry.notificationId === notificationId)
    .sort((a, b) => {
      const delta = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return delta !== 0 ? delta : KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    });
}

/** One row per notification that has any history, most recent activity first. */
export function summarizeNotifications(
  entries: readonly ActivityEntry[]
): NotificationActivitySummary[] {
  const byId = new Map<string, NotificationActivitySummary>();
  const titleRank = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.notificationId) continue;
    const id = entry.notificationId;
    let row = byId.get(id);
    if (!row) {
      row = {
        notificationId: id,
        title: '',
        body: null,
        category: null,
        firstAt: entry.createdAt,
        lastAt: entry.createdAt,
        entryCount: 0,
        sent: false,
        received: false,
        opened: false,
        read: false,
        dismissed: false,
        deleted: false,
      };
      byId.set(id, row);
    }
    row.entryCount += 1;
    if (Date.parse(entry.createdAt) < Date.parse(row.firstAt)) row.firstAt = entry.createdAt;
    if (Date.parse(entry.createdAt) > Date.parse(row.lastAt)) row.lastAt = entry.createdAt;

    // Prefer the creation / deletion snapshot for the title.
    const rank =
      entry.kind === 'notification_created' ? 3 : entry.kind === 'notification_deleted' ? 2 : 1;
    if (entry.title && rank > (titleRank.get(id) ?? 0)) {
      titleRank.set(id, rank);
      row.title = entry.title;
      row.body = entry.body ?? row.body;
      row.category = entry.category ?? row.category;
    }

    switch (entry.kind) {
      case 'notification_push_sent':
        if (Number(entry.detail.devices ?? 1) > 0) row.sent = true;
        break;
      case 'notification_received':
        row.received = true;
        break;
      case 'notification_opened':
        row.opened = true;
        row.received = true;
        break;
      case 'notification_read':
        row.read = true;
        break;
      case 'notification_dismissed':
        row.dismissed = true;
        break;
      case 'notification_deleted':
        row.deleted = true;
        break;
      default:
        break;
    }
  }

  for (const row of byId.values()) {
    if (!row.title) row.title = 'Notification';
  }

  return [...byId.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

function who(entry: ActivityEntry, names: ActivityNames): string | null {
  const fromDetail =
    typeof entry.detail.dismissed_by_member_id === 'string'
      ? names.memberName(entry.detail.dismissed_by_member_id)
      : null;
  return (
    fromDetail ??
    (entry.memberId ? names.memberName(entry.memberId) : null) ??
    (entry.actorUserId ? names.userName(entry.actorUserId) : null)
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function describeActivity(entry: ActivityEntry, names: ActivityNames): DescribedActivity {
  const person = who(entry, names);
  const device = entry.device ? entry.device : null;

  switch (entry.kind) {
    case 'notification_created': {
      const creator = entry.actorUserId ? names.userName(entry.actorUserId) : null;
      return {
        label: 'Created',
        sublabel: creator ? `by ${creator}` : 'by ChoreMaxx',
        icon: 'add-alert',
        tone: 'neutral',
      };
    }
    case 'notification_push_sent': {
      const devices = Number(entry.detail.devices ?? NaN);
      const reason = typeof entry.detail.reason === 'string' ? entry.detail.reason : null;
      if (devices === 0) {
        return {
          label: 'Push not sent',
          sublabel:
            reason === 'prefs_disabled'
              ? 'This alert type is turned off in household settings'
              : 'No phone registered for push',
          icon: 'notifications-off',
          tone: 'warning',
        };
      }
      const errors = Array.isArray(entry.detail.errors) ? entry.detail.errors.length : 0;
      return {
        label: 'Sent to phone',
        sublabel: Number.isFinite(devices)
          ? `${plural(devices, 'device')}${errors ? ` · ${plural(errors, 'delivery error')}` : ''}`
          : null,
        icon: 'send',
        tone: errors ? 'warning' : 'info',
      };
    }
    case 'notification_received':
      return {
        label: device ? `Received on ${device}` : 'Received',
        sublabel: person ? `${person}'s device` : null,
        icon: 'phone-iphone',
        tone: 'info',
      };
    case 'notification_opened':
      return {
        label: person ? `Opened by ${person}` : 'Opened',
        sublabel: device ? `Tapped on ${device}` : null,
        icon: 'touch-app',
        tone: 'success',
      };
    case 'notification_read':
      return {
        label: person ? `Read by ${person}` : 'Marked read',
        sublabel: null,
        icon: 'done-all',
        tone: 'success',
      };
    case 'notification_dismissed':
      return {
        label: person ? `Dismissed by ${person}` : 'Dismissed',
        sublabel: null,
        icon: 'visibility-off',
        tone: 'warning',
      };
    case 'notification_deleted':
      return {
        label: person ? `Deleted by ${person}` : 'Deleted',
        sublabel: person ? null : 'Removed automatically (clean-up)',
        icon: 'delete-outline',
        tone: 'danger',
      };
    case 'assistant_error': {
      const tier = entry.detail.tier === 'max' ? 'Max' : 'Base';
      const stage = typeof entry.detail.stage === 'string' ? entry.detail.stage : null;
      return {
        label: entry.title ?? 'Assistant error',
        sublabel: [person, `${tier} assistant`, stage].filter(Boolean).join(' · '),
        icon: 'error-outline',
        tone: 'danger',
      };
    }
    case 'assistant_report': {
      const tier = entry.detail.tier === 'max' ? 'Max' : 'Base';
      return {
        label: person ? `${person} said the assistant was wrong` : 'Assistant marked wrong',
        sublabel: `${tier} assistant`,
        icon: 'report-gmailerrorred',
        tone: 'warning',
      };
    }
    default:
      return { label: String(entry.kind), sublabel: null, icon: 'history', tone: 'neutral' };
  }
}

/** Absolute stamp for disputes: "Thu 2 Oct · 4:05 PM" (year added when not this year). */
export function formatActivityTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${date.getDate()} ${month}${year} · ${time}`;
}

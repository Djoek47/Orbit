/**
 * Copy + grouping for the Alerts notification prefs panel.
 * Smart delivery is a delivery *mode* (rules-first digests) — not another channel toggle.
 */
import type { MojiName } from '@/components/orbit/moji/art';
import { quietHoursBodyCopy } from '@/lib/notifications/quiet-hours';
import type { PoppinsNotificationPrefs } from '@/types/orbit';

export type NotifPrefKey = keyof PoppinsNotificationPrefs;

/** Pref keys that are modes / schedule — not channel toggles. */
export type NotifHeroKey = 'smartDelivery' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd';

export const SMART_DELIVERY_HERO = {
  eyebrow: 'Recommended',
  title: 'Smart delivery',
  bodyOn:
    'Same-day task noise becomes one calm digest. Full detail lives in Activity. Urgent asks still reach you.',
  bodyOff:
    'Each new task can push on its own. Turn Smart on when you want fewer banners and a clearer day.',
} as const;

export const SMART_DELIVERY_CHIPS: { label: string; moji: MojiName; color: string }[] = [
  { label: 'Task digests', moji: 'check', color: '#34D399' },
  { label: 'Activity details', moji: 'sparkles', color: '#8E7CFF' },
  { label: 'Urgent still push', moji: 'bolt', color: '#FF6A3D' },
  { label: 'Quiet nights', moji: 'moon', color: '#7C9CFF' },
];

export function quietHoursCopy(
  startHm?: string | null,
  endHm?: string | null,
  use24h = true
): string {
  return quietHoursBodyCopy(startHm, endHm, use24h);
}

type ChannelMeta = { label: string; sub: string; emoji: string };

type ChannelGroup = {
  id: string;
  title: string;
  color: string;
  keys: Exclude<NotifPrefKey, NotifHeroKey>[];
  meta: Record<string, ChannelMeta>;
};

/** Condensed channel groups — excludes Smart + Quiet (those are heroes above). */
export function channelGroups(): ChannelGroup[] {
  return [
    {
      id: 'household',
      title: 'Household',
      color: '#17B9A0',
      keys: ['tasks', 'rewards', 'groceries', 'itinerary'],
      meta: {
        tasks: {
          label: 'Tasks & streaks',
          sub: 'Due work, photos, streak risk',
          emoji: '✅',
        },
        rewards: {
          label: 'Rewards & allowance',
          sub: 'Claims, approvals, paid allowance',
          emoji: '🎁',
        },
        groceries: {
          label: 'Groceries',
          sub: 'List updates for the house',
          emoji: '🛒',
        },
        itinerary: {
          label: 'Plan & trips',
          sub: 'Trip nudges when you want them',
          emoji: '🗺️',
        },
      },
    },
    {
      id: 'ideas',
      title: 'Ideas',
      color: '#E9B44C',
      keys: ['deals', 'plans', 'xpFairness'],
      meta: {
        deals: {
          label: 'Deal ideas',
          sub: 'Gentle suggestions in the app',
          emoji: '🏷️',
        },
        plans: {
          label: 'Plan ideas',
          sub: 'Outing ideas in the app',
          emoji: '🗺️',
        },
        xpFairness: {
          label: 'Fairness notes',
          sub: 'Balance tips for the house',
          emoji: '⚖️',
        },
      },
    },
    {
      id: 'shopping',
      title: 'Shopping',
      color: '#FF6A3D',
      keys: ['nearShop', 'missingOnTheWay'],
      meta: {
        nearShop: {
          label: 'Near shop',
          sub: 'Ask before opening your list at a store',
          emoji: '📍',
        },
        missingOnTheWay: {
          label: 'Missing on the way',
          sub: 'A nudge while you’re out shopping',
          emoji: '🧾',
        },
      },
    },
  ];
}

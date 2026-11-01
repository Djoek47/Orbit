/**
 * Copy + grouping for the Alerts notification prefs panel.
 * Smart delivery is a delivery *mode* (rules-first digests) — not another channel toggle.
 */
import { quietHoursBodyCopy } from '@/lib/notifications/quiet-hours';
import type { PoppinsNotificationPrefs } from '@/types/orbit';

export type NotifPrefKey = keyof PoppinsNotificationPrefs;

/** Pref keys that are modes / schedule — not channel toggles. */
export type NotifHeroKey = 'smartDelivery' | 'quietHoursEnabled' | 'quietHoursStart' | 'quietHoursEnd';

/**
 * What the setting actually does (see smart-digest.ts): when 2+ new tasks are assigned to you
 * in the same send, they arrive as one notification ("3 tasks are ready for you") instead of
 * one each. Nothing else is held back or delayed.
 */
export const SMART_DELIVERY_HERO = {
  eyebrow: 'Recommended',
  title: 'Bundle new tasks',
  bodyOn: 'When several tasks are added for you at once, you get one notification instead of one for each.',
  bodyOff: 'Every new task sends its own notification.',
  previewLabelOn: 'What you’ll get',
  previewLabelOff: 'What you get now',
  footOn: 'Reminders, rewards and everything else still come one at a time. Every task is listed in Activity.',
  footOff: 'Turn on to get one notification when several tasks are added at once.',
  /** Short value for the summary tile at the top of the screen. */
  factOn: 'Bundled',
  factOff: 'One by one',
  factLabel: 'new tasks',
} as const;

/** Example banners for the preview: the same tasks, bundled or not. */
export const SMART_DELIVERY_PREVIEW = {
  separate: [
    { title: 'Poppins · Tasks', body: 'Take out the trash was added to your list.' },
    { title: 'Poppins · Tasks', body: 'Empty the dishwasher was added to your list.' },
    { title: 'Poppins · Tasks', body: 'Feed the dog was added to your list.' },
  ],
  bundled: { title: 'Poppins · Today', body: '3 tasks are ready for you. Open Activity to see who’s on what.' },
} as const;

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

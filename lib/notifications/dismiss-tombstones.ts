/**
 * Local dismiss tombstones — survive poll/refresh races until DB catches up.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/notification_dismissed.v1';

type TombstoneMap = Record<string, string[]>;

function storageKey(householdId: string, memberId: string): string {
  return `${KEY}:${householdId}:${memberId}`;
}

export async function loadDismissedNotificationIds(
  householdId: string,
  memberId: string
): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(householdId, memberId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function rememberDismissedNotification(
  householdId: string,
  memberId: string,
  notificationId: string
): Promise<void> {
  const set = await loadDismissedNotificationIds(householdId, memberId);
  if (set.has(notificationId)) return;
  set.add(notificationId);
  const ids = [...set].slice(-200);
  await AsyncStorage.setItem(storageKey(householdId, memberId), JSON.stringify(ids));
}

export async function rememberDismissedNotifications(
  householdId: string,
  memberId: string,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  const set = await loadDismissedNotificationIds(householdId, memberId);
  for (const id of notificationIds) set.add(id);
  const ids = [...set].slice(-200);
  await AsyncStorage.setItem(storageKey(householdId, memberId), JSON.stringify(ids));
}

/** In-memory helper for tests / sync merge without AsyncStorage. */
export function filterOutDismissedIds<T extends { id: string }>(
  items: T[],
  dismissedIds: Set<string> | Iterable<string>
): T[] {
  const set = dismissedIds instanceof Set ? dismissedIds : new Set(dismissedIds);
  if (set.size === 0) return items;
  return items.filter((item) => !set.has(item.id));
}

export type { TombstoneMap };

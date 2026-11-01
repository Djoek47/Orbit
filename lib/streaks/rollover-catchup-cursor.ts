/**
 * Persist which local calendar day was last classified for streaks.
 * Prevents cold-start / foreground catch-up from replaying 7 days against an
 * empty in-memory engine and overwriting the saved personal streak.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addLocalDays } from '@/lib/streaks/local-date';

const KEY = '@orbit/streak_rollover_catchup_v1';

export async function loadStreakCatchUpCursor(householdId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}`);
    return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveStreakCatchUpCursor(householdId: string, localDate: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}`, localDate);
  } catch (error) {
    console.warn('saveStreakCatchUpCursor', error);
  }
}

/**
 * Days strictly after `cursor` up to and including `yesterday`.
 * Empty when already caught up.
 */
export function pendingCatchUpDays(cursor: string | null, yesterday: string): string[] {
  if (!cursor) return [];
  if (cursor >= yesterday) return [];
  const days: string[] = [];
  let next = addLocalDays(cursor, 1);
  // Cap so a corrupted cursor can't spin forever.
  for (let i = 0; i < 31 && next <= yesterday; i += 1) {
    days.push(next);
    next = addLocalDays(next, 1);
  }
  return days;
}

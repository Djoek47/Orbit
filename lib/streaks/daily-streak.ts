import AsyncStorage from '@react-native-async-storage/async-storage';

import { addLocalDays, formatLocalDate } from '@/lib/streaks/local-date';

const KEY = '@orbit/daily_streak_award';

function todayKey(timeZone?: string) {
  return formatLocalDate(new Date(), timeZone);
}

function yesterdayKey(timeZone?: string) {
  return addLocalDays(todayKey(timeZone), -1);
}

type StreakRecord = {
  lastAwardDate: string;
  streak: number;
};

async function loadRecord(
  householdId: string,
  memberId: string
): Promise<StreakRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(`${KEY}:${householdId}:${memberId}`);
    return raw ? (JSON.parse(raw) as StreakRecord) : null;
  } catch {
    return null;
  }
}

async function saveRecord(householdId: string, memberId: string, record: StreakRecord) {
  try {
    await AsyncStorage.setItem(`${KEY}:${householdId}:${memberId}`, JSON.stringify(record));
  } catch (error) {
    console.warn('saveDailyStreak failed', error);
  }
}

/**
 * Award +1 streak once per household-local calendar day when today's tasks are all done.
 * If the previous award wasn't yesterday (or today), streak resets to 1.
 */
export async function awardDailyStreakIfNeeded(input: {
  householdId: string | null | undefined;
  memberId: string | null | undefined;
  currentStreak: number;
  timeZone?: string;
}): Promise<{ awarded: boolean; streak: number }> {
  const { householdId, memberId, currentStreak, timeZone } = input;
  if (!householdId || !memberId) {
    return { awarded: false, streak: currentStreak };
  }

  const today = todayKey(timeZone);
  const existing = await loadRecord(householdId, memberId);
  if (existing?.lastAwardDate === today) {
    return { awarded: false, streak: existing.streak };
  }

  const yesterday = yesterdayKey(timeZone);
  let nextStreak: number;
  if (!existing) {
    // No device-local award record (fresh install / new face) — continue from
    // the household streak already on the member row. Never hard-reset to 1.
    nextStreak = Math.max(1, Math.max(0, currentStreak) + 1);
  } else if (existing.lastAwardDate === yesterday) {
    nextStreak = Math.max(0, existing.streak) + 1;
  } else {
    // Confirmed gap on this device.
    nextStreak = 1;
  }
  await saveRecord(householdId, memberId, { lastAwardDate: today, streak: nextStreak });
  return { awarded: true, streak: nextStreak };
}

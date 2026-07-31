import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/daily_streak_award';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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
 * Award +1 streak once per local calendar day when today's tasks are all done.
 * If the previous award wasn't yesterday (or today), streak resets to 1.
 */
export async function awardDailyStreakIfNeeded(input: {
  householdId: string | null | undefined;
  memberId: string | null | undefined;
  currentStreak: number;
}): Promise<{ awarded: boolean; streak: number }> {
  const { householdId, memberId, currentStreak } = input;
  if (!householdId || !memberId) {
    return { awarded: false, streak: currentStreak };
  }

  const today = todayKey();
  const existing = await loadRecord(householdId, memberId);
  if (existing?.lastAwardDate === today) {
    return { awarded: false, streak: existing.streak };
  }

  const continued = existing?.lastAwardDate === yesterdayKey();
  const nextStreak = continued ? (existing?.streak ?? currentStreak) + 1 : 1;
  await saveRecord(householdId, memberId, { lastAwardDate: today, streak: nextStreak });
  return { awarded: true, streak: nextStreak };
}

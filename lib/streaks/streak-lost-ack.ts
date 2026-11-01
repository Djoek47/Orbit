/**
 * Persist “Got it” on the streak-ended sheet so shared-device Switch doesn’t
 * re-show it every Emma ↔ Jack hop. Cleared on full sign-out so the next
 * sign-in can show again for the same cliff.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'choremaxx.streak-lost-ack.v1';

/** In-memory when AsyncStorage unavailable (Node tests). */
const memory = new Set<string>();

function ackKey(memberId: string, streakEndedAt: string): string {
  return `${memberId.trim()}:${streakEndedAt.trim()}`;
}

async function readAll(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return new Set(memory);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(memory);
    const next = new Set(
      parsed.filter((item): item is string => typeof item === 'string' && item.includes(':'))
    );
    for (const item of memory) next.add(item);
    return next;
  } catch {
    return new Set(memory);
  }
}

async function writeAll(keys: Set<string>): Promise<void> {
  memory.clear();
  for (const item of keys) memory.add(item);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...keys]));
  } catch {
    /* memory still holds acks */
  }
}

export async function hasAcknowledgedStreakLost(
  memberId: string,
  streakEndedAt: string
): Promise<boolean> {
  if (!memberId.trim() || !streakEndedAt.trim()) return false;
  const all = await readAll();
  return all.has(ackKey(memberId, streakEndedAt));
}

export async function acknowledgeStreakLost(
  memberId: string,
  streakEndedAt: string
): Promise<void> {
  if (!memberId.trim() || !streakEndedAt.trim()) return;
  const all = await readAll();
  all.add(ackKey(memberId, streakEndedAt));
  // Cap growth — keep latest 40 cliffs.
  if (all.size > 40) {
    const trimmed = [...all].slice(-40);
    await writeAll(new Set(trimmed));
    return;
  }
  await writeAll(all);
}

/** Call from full sign-out so the next login can see the sheet again. */
export async function clearStreakLostAcks(): Promise<void> {
  memory.clear();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Test helper. */
export async function resetStreakLostAcksForTests(): Promise<void> {
  await clearStreakLostAcks();
}

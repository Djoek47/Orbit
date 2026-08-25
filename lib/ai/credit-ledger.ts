import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AiUsageEvent } from '@/lib/ai/credits';

const keyFor = (householdId: string) => `orbit.ai-usage.${householdId}`;

export async function loadAiUsageEvents(householdId: string | null | undefined): Promise<AiUsageEvent[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUsageEvent);
  } catch {
    return [];
  }
}

export async function saveAiUsageEvents(
  householdId: string | null | undefined,
  events: AiUsageEvent[]
): Promise<void> {
  if (!householdId) return;
  const trimmed = events.slice(-400);
  await AsyncStorage.setItem(keyFor(householdId), JSON.stringify(trimmed));
}

function isUsageEvent(row: unknown): row is AiUsageEvent {
  if (!row || typeof row !== 'object') return false;
  const item = row as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.at === 'string' &&
    typeof item.memberId === 'string' &&
    typeof item.usd === 'number'
  );
}

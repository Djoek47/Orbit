/**
 * Persist allowance rules (Rev F §11) — mock / local until Supabase table ships.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AllowanceRule } from '@/lib/rewards/allowance-progress';

const keyFor = (householdId: string) => `choremaxx:allowance-rules:${householdId}`;

export async function loadAllowanceRules(householdId: string): Promise<AllowanceRule[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AllowanceRule[];
    return Array.isArray(parsed) ? parsed.filter((r) => r.active !== false) : [];
  } catch {
    return [];
  }
}

export async function saveAllowanceRules(
  householdId: string,
  rules: AllowanceRule[]
): Promise<void> {
  if (!householdId) return;
  await AsyncStorage.setItem(keyFor(householdId), JSON.stringify(rules));
}

export async function upsertAllowanceRule(
  householdId: string,
  rule: AllowanceRule
): Promise<AllowanceRule[]> {
  const current = await loadAllowanceRules(householdId);
  const next = [...current.filter((r) => r.id !== rule.id), rule];
  await saveAllowanceRules(householdId, next);
  return next;
}

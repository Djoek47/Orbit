/**
 * Mock-mode registry so users with multiple households can switch between them in Expo Go.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HouseholdSnapshot } from '@/types/orbit';

const KEY = '@orbit/mock_household_registry.v1';

type Registry = Record<string, HouseholdSnapshot>;

async function loadRegistry(): Promise<Registry> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Registry;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveRegistry(registry: Registry): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(registry));
  } catch (error) {
    console.warn('saveMockHouseholdRegistry failed', error);
  }
}

export async function upsertMockHouseholdRegistry(snapshot: HouseholdSnapshot): Promise<void> {
  if (!snapshot.id) return;
  const registry = await loadRegistry();
  registry[snapshot.id] = snapshot;
  await saveRegistry(registry);
}

export async function getMockHouseholdFromRegistry(
  householdId: string
): Promise<HouseholdSnapshot | null> {
  const registry = await loadRegistry();
  const match = registry[householdId];
  return match?.id ? match : null;
}

export async function listMockHouseholdRegistry(): Promise<HouseholdSnapshot[]> {
  const registry = await loadRegistry();
  return Object.values(registry).filter((item) => Boolean(item?.id));
}

export async function removeMockHouseholdFromRegistry(householdId: string): Promise<void> {
  const registry = await loadRegistry();
  if (!registry[householdId]) return;
  delete registry[householdId];
  await saveRegistry(registry);
}

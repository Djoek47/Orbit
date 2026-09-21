/**
 * Household Poppins act mode — Quiet (silent) default.
 * Stored locally until a household column ships.
 * Legacy stored `live` migrates to `spoken` (Speak back).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PoppinsActMode } from '@/lib/ai/credits';

const keyFor = (householdId: string) => `orbit.poppins-mode.${householdId}`;

const DEFAULT_MODE: PoppinsActMode = 'silent';

let cache = new Map<string, PoppinsActMode>();

export function defaultPoppinsActMode(): PoppinsActMode {
  return DEFAULT_MODE;
}

export function isLiveModeEnabled(): boolean {
  // Launch: duplex Realtime is Speak back (`spoken`), not a third mode.
  return false;
}

function migrateMode(raw: string | null): PoppinsActMode | null {
  if (raw === 'silent' || raw === 'spoken') return raw;
  if (raw === 'live') return 'spoken';
  return null;
}

export async function loadPoppinsActMode(
  householdId: string | null | undefined
): Promise<PoppinsActMode> {
  if (!householdId) return DEFAULT_MODE;
  const cached = cache.get(householdId);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    const migrated = migrateMode(raw);
    if (migrated) {
      if (raw === 'live') {
        await AsyncStorage.setItem(keyFor(householdId), migrated);
      }
      cache.set(householdId, migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  cache.set(householdId, DEFAULT_MODE);
  return DEFAULT_MODE;
}

export async function savePoppinsActMode(
  householdId: string | null | undefined,
  mode: PoppinsActMode | 'live'
): Promise<void> {
  if (!householdId) return;
  const next: PoppinsActMode = mode === 'live' ? 'spoken' : mode;
  cache.set(householdId, next);
  await AsyncStorage.setItem(keyFor(householdId), next);
}

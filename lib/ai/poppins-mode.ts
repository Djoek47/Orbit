/**
 * Household Poppins act mode — Silent default, Live off at launch.
 * Stored locally until a household column ships.
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
  // Launch: Live stays off until A5 Spoken feels right and metering is trusted.
  return false;
}

export async function loadPoppinsActMode(
  householdId: string | null | undefined
): Promise<PoppinsActMode> {
  if (!householdId) return DEFAULT_MODE;
  const cached = cache.get(householdId);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (raw === 'spoken' || raw === 'silent') {
      cache.set(householdId, raw);
      return raw;
    }
    if (raw === 'live' && isLiveModeEnabled()) {
      cache.set(householdId, 'live');
      return 'live';
    }
  } catch {
    /* ignore */
  }
  cache.set(householdId, DEFAULT_MODE);
  return DEFAULT_MODE;
}

export async function savePoppinsActMode(
  householdId: string | null | undefined,
  mode: PoppinsActMode
): Promise<void> {
  if (!householdId) return;
  const next: PoppinsActMode =
    mode === 'live' && !isLiveModeEnabled() ? 'spoken' : mode === 'live' ? 'live' : mode;
  cache.set(householdId, next);
  await AsyncStorage.setItem(keyFor(householdId), next);
}

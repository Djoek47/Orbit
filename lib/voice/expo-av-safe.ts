/**
 * Expo Go SDK 57+ no longer ships the `ExponentAV` native module (`expo-av`
 * was replaced by `expo-audio` / `expo-video`). Top-level `import from 'expo-av'`
 * crashes the whole JS bundle when that native module is missing.
 *
 * Load lazily and treat absence as "voice capture unavailable" so the rest of
 * the app (Home, tour, Tasks, …) still runs in Expo Go.
 */

type ExpoAvModule = typeof import('expo-av');

let cached: ExpoAvModule | null | undefined;

export function getExpoAv(): ExpoAvModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-av') as ExpoAvModule;
  } catch (error) {
    console.warn('[expo-av] unavailable in this runtime (expected on Expo Go 57+)', error);
    cached = null;
  }
  return cached;
}

export function isExpoAvAvailable(): boolean {
  return getExpoAv() != null;
}

export function expoAvUnavailableMessage(): string {
  return 'Voice capture needs a native build — Expo Go no longer includes expo-av.';
}

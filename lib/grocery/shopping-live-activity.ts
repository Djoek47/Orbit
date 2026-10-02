/**
 * The shopping run on the Lock Screen and in the Dynamic Island (iOS Live Activity).
 *
 *   ┌ ChoreMaxx ─────────────────────┐
 *   │ Shopping run                   │
 *   │ 3 of 9 · Dairy & Eggs next     │
 *   │ ▓▓▓▓▓░░░░░░░░                  │
 *   └────────────────────────────────┘
 *
 * Starts when Start shopping is tapped, follows every tick, and ends with the run.
 * Apple only allows this from a real build (iOS 16.2+), so every call is guarded: the
 * module is loaded lazily and any failure leaves shopping working exactly as before.
 */
import { Platform } from 'react-native';

import {
  shoppingBannerFinalSubtitle,
  shoppingBannerState,
  type ShoppingRunState,
} from '@/lib/grocery/shopping-banner-copy';

export type { ShoppingRunState };

type ActivityState = {
  title: string;
  imageName?: string;
  dynamicIslandImageName?: string;
  subtitle?: string;
  progressBar?: { progress?: number; date?: number };
};

type ActivityConfig = {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  progressViewTint?: string;
  progressViewLabelColor?: string;
  deepLinkUrl?: string;
};

type LiveActivityModule = {
  startActivity: (state: ActivityState, config?: ActivityConfig) => string | undefined;
  updateActivity: (id: string, state: ActivityState) => void;
  stopActivity: (id: string, state: ActivityState) => void;
  areActivitiesEnabled?: () => boolean;
};

let moduleRef: LiveActivityModule | null | undefined;

function liveActivity(): LiveActivityModule | null {
  if (moduleRef !== undefined) return moduleRef;
  if (Platform.OS !== 'ios') {
    moduleRef = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduleRef = require('expo-live-activity') as LiveActivityModule;
  } catch {
    // Not in this build (Expo Go, or an older binary) — shopping just works without it.
    moduleRef = null;
  }
  return moduleRef;
}

/** Grocery Lock Screen banner is off for now — always false. */
export function shoppingBannerAvailable(): boolean {
  return false;
}

let currentId: string | null = null;

/** The logo in the Dynamic Island (from assets/liveActivity). */
const withMark = (run: ShoppingRunState) => ({
  ...shoppingBannerState(run),
  dynamicIslandImageName: 'choremaxx_mark',
});

/** No-op while grocery Lock Screen is disabled. */
export function startShoppingBanner(_run: ShoppingRunState, _accent: string): string | null {
  return null;
}

/** No-op while grocery Lock Screen is disabled. */
export function updateShoppingBanner(_run: ShoppingRunState): void {
  // intentionally empty
}

export function stopShoppingBanner(run?: ShoppingRunState): void {
  const mod = liveActivity();
  if (!mod || !currentId) return;
  const final = run ?? { done: 0, total: 0 };
  try {
    mod.stopActivity(currentId, {
      ...withMark(final),
      subtitle: shoppingBannerFinalSubtitle(final),
    });
  } catch (error) {
    console.warn('stopShoppingBanner', error);
  } finally {
    currentId = null;
  }
}


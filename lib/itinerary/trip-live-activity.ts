/**
 * Trip Live Activity — Lock Screen / Dynamic Island for the current stop.
 * Same expo-live-activity module as shopping; safe no-op on Expo Go / Android.
 */
import { Platform } from 'react-native';

import {
  tripBannerFinalSubtitle,
  tripBannerState,
  type TripRunState,
} from '@/lib/itinerary/trip-banner-copy';

export type { TripRunState };

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
let currentId: string | null = null;
let currentTripId: string | null = null;

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
    moduleRef = null;
  }
  return moduleRef;
}

export function tripBannerAvailable(): boolean {
  const mod = liveActivity();
  if (!mod) return false;
  try {
    return mod.areActivitiesEnabled ? mod.areActivitiesEnabled() : true;
  } catch {
    return true;
  }
}

const withMark = (run: TripRunState) => ({
  ...tripBannerState(run),
  dynamicIslandImageName: 'choremaxx_mark',
});

export function startTripBanner(
  tripId: string,
  run: TripRunState,
  accent: string
): string | null {
  const mod = liveActivity();
  if (!mod) return null;
  if (currentId && currentTripId === tripId) {
    updateTripBanner(run);
    return currentId;
  }
  if (currentId) {
    stopTripBanner();
  }
  try {
    const id = mod.startActivity(withMark(run), {
      backgroundColor: '#17110E',
      titleColor: '#F7F2EC',
      subtitleColor: '#C9B8AA',
      progressViewTint: accent,
      progressViewLabelColor: '#F5F7FA',
      deepLinkUrl: `/itinerary/${tripId}`,
    });
    currentId = id ?? null;
    currentTripId = tripId;
    return currentId;
  } catch (error) {
    console.warn('startTripBanner', error);
    return null;
  }
}

export function updateTripBanner(run: TripRunState): void {
  const mod = liveActivity();
  if (!mod || !currentId) return;
  try {
    mod.updateActivity(currentId, withMark(run));
  } catch (error) {
    console.warn('updateTripBanner', error);
  }
}

export function stopTripBanner(run?: TripRunState): void {
  const mod = liveActivity();
  if (!mod || !currentId) return;
  const final = run ?? {
    tripTitle: 'Trip',
    index: 0,
    total: 0,
    currentLabel: '',
    remainingStops: [],
  };
  try {
    mod.stopActivity(currentId, {
      ...withMark(final),
      subtitle: tripBannerFinalSubtitle(final),
    });
  } catch (error) {
    console.warn('stopTripBanner', error);
  } finally {
    currentId = null;
    currentTripId = null;
  }
}

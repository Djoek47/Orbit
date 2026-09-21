/**
 * Unstick users trapped on a prior tour build (WO9.3 §3.9).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadLastAppError } from '@/lib/errors/last-error';
import { loadTourState, saveTourState, skipTourState } from '@/lib/tour/tour-store';
import type { TourId } from '@/lib/tour/tour-types';

const LAUNCH_KEY = 'orbit.tour.launchWatch.v1';
const RECOVERED_KEY = 'orbit.tour.recoveredAt.v1';
const TOUR_IDS: TourId[] = ['admin', 'sidekick', 'family_ipad', 'joined_adult'];

type LaunchWatch = {
  /** Consecutive cold starts without a visible Home interaction / tour card. */
  blankLaunches: number;
  updatedAt: string;
};

async function readWatch(): Promise<LaunchWatch> {
  try {
    const raw = await AsyncStorage.getItem(LAUNCH_KEY);
    if (!raw) return { blankLaunches: 0, updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as LaunchWatch;
    return {
      blankLaunches: Number(parsed.blankLaunches) || 0,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return { blankLaunches: 0, updatedAt: new Date().toISOString() };
  }
}

async function writeWatch(watch: LaunchWatch): Promise<void> {
  try {
    await AsyncStorage.setItem(LAUNCH_KEY, JSON.stringify(watch));
  } catch {
    /* ignore */
  }
}

/** Call when Home has been mounted 5s, or a tour card is visible. */
export async function markTourSessionHealthy(): Promise<void> {
  await writeWatch({ blankLaunches: 0, updatedAt: new Date().toISOString() });
}

async function skipAllTours(householdId: string, memberId: string): Promise<void> {
  for (const tourId of TOUR_IDS) {
    const state = await loadTourState(householdId, memberId, tourId);
    if (state.status === 'in_progress' || state.status === 'offered') {
      await saveTourState(householdId, memberId, skipTourState(state));
    }
  }
}

export function shouldRecoverTourError(
  lastErrorAt: string | undefined,
  recoveredAt: string | null
): boolean {
  if (!lastErrorAt) return false;
  return lastErrorAt !== recoveredAt;
}

async function readRecoveredAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(RECOVERED_KEY);
  } catch {
    return null;
  }
}

async function writeRecoveredAt(at: string): Promise<void> {
  try {
    await AsyncStorage.setItem(RECOVERED_KEY, at);
  } catch {
    /* ignore */
  }
}

/**
 * Before hydrating the tour: if the last session crashed in the tour layer,
 * or two launches in a row never reached a healthy Home, force every tour skipped.
 */
export async function recoverStuckTourIfNeeded(
  householdId: string,
  memberId: string
): Promise<{ recovered: boolean; reason?: string }> {
  const lastError = await loadLastAppError();
  const recoveredAt = await readRecoveredAt();
  const tourCrashed =
    Boolean(lastError?.message?.startsWith('tour:')) &&
    shouldRecoverTourError(lastError?.at, recoveredAt);

  const watch = await readWatch();
  const nextBlank = watch.blankLaunches + 1;
  await writeWatch({ blankLaunches: nextBlank, updatedAt: new Date().toISOString() });

  if (tourCrashed || nextBlank >= 2) {
    await skipAllTours(householdId, memberId);
    await writeWatch({ blankLaunches: 0, updatedAt: new Date().toISOString() });
    if (tourCrashed && lastError?.at) {
      await writeRecoveredAt(lastError.at);
    }
    return {
      recovered: true,
      reason: tourCrashed ? 'tour_error' : 'blank_launches',
    };
  }

  return { recovered: false };
}

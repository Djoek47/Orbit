import { dataMode } from '@/config/data-mode';
import { isReviewDemoActive } from '@/lib/auth/review-demo';
import { getSupabaseClient, requireSupabaseClient } from '@/lib/supabase/client';

export { isUniqueViolation } from '@/lib/db/unique-violation';

/**
 * Local demo data paths (Rivera household, in-memory repos).
 * - Expo Go: `EXPO_PUBLIC_DATA_MODE=mock` + `__DEV__`
 * - TestFlight/App Store: only when Apple Review demo credentials unlocked a session
 */
export function isMockMode() {
  return (dataMode === 'mock' && __DEV__) || isReviewDemoActive();
}

export function requireMockOrSupabaseReady(repositoryName: string) {
  if (dataMode === 'mock') {
    return;
  }

  if (!getSupabaseClient()) {
    throw new Error(`${repositoryName} is in Supabase mode, but Supabase is not configured.`);
  }
}

export function getConfiguredSupabase(repositoryName: string) {
  requireMockOrSupabaseReady(repositoryName);
  return requireSupabaseClient();
}

export function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mapDbError(scope: string, error: { message?: string } | null) {
  if (!error) {
    return;
  }
  throw new Error(`${scope}: ${error.message ?? 'Unknown Supabase error'}`);
}

export { isPersistedHouseholdId, assertHouseholdUuid, InvalidHouseholdIdError, liveHouseholdIdOrThrow } from '@/lib/household/persisted-household-id';

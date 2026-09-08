/**
 * Post-email-confirm Premium trial gate.
 * Tracks whether the onboarding paywall was completed or deferred.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/premium_onboarding_gate';

export type PremiumGateState = 'pending' | 'started' | 'deferred' | 'skipped';

export async function getPremiumOnboardingGate(): Promise<PremiumGateState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'pending' || raw === 'started' || raw === 'deferred' || raw === 'skipped') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setPremiumOnboardingGate(state: PremiumGateState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, state);
  } catch (error) {
    console.warn('setPremiumOnboardingGate failed', error);
  }
}

/** After email confirm: always show Premium once until started/deferred. */
export async function markPremiumGatePending(): Promise<void> {
  const current = await getPremiumOnboardingGate();
  if (current === 'started') return;
  await setPremiumOnboardingGate('pending');
}

export function premiumOnboardingHref(params?: { source?: string }) {
  const source = params?.source ?? 'onboarding';
  return { pathname: '/premium' as const, params: { source } };
}

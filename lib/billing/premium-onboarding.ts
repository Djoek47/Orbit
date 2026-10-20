/**
 * Post-email-confirm Premium trial gate.
 * Tracks whether the onboarding paywall was completed or deferred.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/premium_onboarding_gate';

export type PremiumGateState = 'pending' | 'started' | 'deferred' | 'skipped';

/** Cross-screen lock so confirm-email + auth/callback cannot push Premium twice. */
let premiumOnboardingNavLock = false;

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
    if (state === 'started' || state === 'deferred' || state === 'skipped') {
      premiumOnboardingNavLock = false;
    }
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

/**
 * Navigate to the post-confirm Premium sheet at most once per confirmation.
 * Prevents the double-flash when OTP verify and onAuthStateChange both fire,
 * or when auth/callback and confirm-email race.
 */
export async function goPremiumOnboardingOnce(navigate: () => void): Promise<boolean> {
  if (premiumOnboardingNavLock) return false;
  const gate = await getPremiumOnboardingGate();
  if (gate === 'started' || gate === 'deferred' || gate === 'skipped') {
    return false;
  }
  premiumOnboardingNavLock = true;
  await markPremiumGatePending();
  navigate();
  return true;
}

/** Test helper — reset the in-memory nav lock. */
export function __resetPremiumOnboardingNavLockForTests() {
  premiumOnboardingNavLock = false;
}

export function premiumOnboardingHref(params?: { source?: string }) {
  const source = params?.source ?? 'onboarding';
  return { pathname: '/premium' as const, params: { source } };
}

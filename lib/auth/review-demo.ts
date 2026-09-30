/**
 * Apple Beta App Review demo access.
 *
 * TestFlight builds are supabase-only and block Expo Go mock login. Reviewers
 * need a working Sign in (Guideline 2.1(a)). These credentials unlock a local
 * demo session that reuses the rich Rivera mock household — only when matched.
 * Real users keep the live Supabase path.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'choremaxx.reviewDemo.v1';

/** Put these in App Store Connect → TestFlight → Test Information → Beta App Review. */
export const REVIEW_DEMO_EMAIL = 'review@choremaxx.app';
export const REVIEW_DEMO_PASSWORD = 'ReviewDemo2026!';

export const REVIEW_DEMO_USER = {
  id: 'user-apple-review',
  email: REVIEW_DEMO_EMAIL,
  name: 'Sarah',
  avatar: 'S',
  profileComplete: true,
} as const;

let active = false;
let bootstrapped = false;

export function isReviewDemoActive(): boolean {
  return active;
}

export function matchesReviewDemoCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === REVIEW_DEMO_EMAIL.toLowerCase() &&
    password === REVIEW_DEMO_PASSWORD
  );
}

/** Must run before the first `isMockMode()` check on cold start. */
export async function bootstrapReviewDemoFlag(): Promise<boolean> {
  if (bootstrapped) return active;
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    active = value === '1';
  } catch {
    active = false;
  }
  bootstrapped = true;
  return active;
}

export async function enableReviewDemoSession(): Promise<void> {
  active = true;
  bootstrapped = true;
  await AsyncStorage.setItem(STORAGE_KEY, '1');
}

export async function clearReviewDemoSession(): Promise<void> {
  active = false;
  bootstrapped = true;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

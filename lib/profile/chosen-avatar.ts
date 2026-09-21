import { isAvatarImageUri } from '@/lib/game-levels';

/**
 * True when the user picked a real look (photo URI or emoji), not a
 * generated initial like "S" / "JL".
 */
export function hasChosenAvatar(avatar?: string | null): boolean {
  const value = avatar?.trim();
  if (!value) return false;
  if (isAvatarImageUri(value)) return true;
  if (/^[A-Za-z0-9]{1,3}$/.test(value)) return false;
  return true;
}

/** Prefill onboarding with a chosen look; leave initials blank so they can pick. */
export function seedOnboardingAvatar(avatar?: string | null): string {
  const value = avatar?.trim();
  return value && hasChosenAvatar(value) ? value : '';
}

export type OnboardingIdentityStep = 'profile' | 'household';

/**
 * After Apple / email identity exists: still stop on profile when no photo
 * is available, unless household setup already started (don't yank them back).
 */
export function onboardingStepAfterIdentity(input: {
  nameComplete: boolean;
  avatar?: string | null;
  householdDraftStarted?: boolean;
}): OnboardingIdentityStep {
  if (!input.nameComplete) return 'profile';
  if (!hasChosenAvatar(input.avatar) && !input.householdDraftStarted) return 'profile';
  return 'household';
}

import { router } from 'expo-router';

import { clearInviteCode } from '@/lib/invite/invite-code-store';

/**
 * Leave a stashed household invite and open Get Started.
 * Does not clear a pending join request — sign-in still resumes Waiting for approval.
 */
export async function goToFreshLogin(): Promise<void> {
  await clearInviteCode();
  router.replace('/welcome');
}

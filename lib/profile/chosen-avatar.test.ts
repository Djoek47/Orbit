/**
 * Onboarding should prompt for a photo when none is available.
 * Run: npx tsx lib/profile/chosen-avatar.test.ts
 */

import {
  hasChosenAvatar,
  onboardingStepAfterIdentity,
  seedOnboardingAvatar,
} from '@/lib/profile/chosen-avatar';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(!hasChosenAvatar(undefined), 'empty undefined');
assert(!hasChosenAvatar(''), 'empty string');
assert(!hasChosenAvatar('S'), 'single initial');
assert(!hasChosenAvatar('JL'), 'two-letter initial');
assert(hasChosenAvatar('🦊'), 'emoji');
assert(hasChosenAvatar('file:///avatars/me.jpg'), 'file uri');
assert(hasChosenAvatar('https://cdn.example/a.png'), 'https uri');
assert(hasChosenAvatar('data:image/png;base64,abc'), 'data uri');
assert(seedOnboardingAvatar('S') === '', 'seed drops initial');
assert(seedOnboardingAvatar('🌟') === '🌟', 'seed keeps emoji');

assert(
  onboardingStepAfterIdentity({ nameComplete: false, avatar: 'S' }) === 'profile',
  'incomplete name → profile'
);
assert(
  onboardingStepAfterIdentity({ nameComplete: true, avatar: 'J' }) === 'profile',
  'Apple name, no photo → profile'
);
assert(
  onboardingStepAfterIdentity({ nameComplete: true, avatar: '🦊' }) === 'household',
  'chosen emoji skips profile'
);
assert(
  onboardingStepAfterIdentity({
    nameComplete: true,
    avatar: 'J',
    householdDraftStarted: true,
  }) === 'household',
  'mid household draft is not yanked back'
);

console.log('PASS chosen-avatar onboarding photo gate');

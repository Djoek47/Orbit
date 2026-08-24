/**
 * Shared iPad defaults + session helpers.
 * Run: npx --yes tsx lib/household/shared-ipad.test.ts
 */
import assert from 'node:assert/strict';

import { DEFAULT_SHARED_IPAD_NAME } from '@/lib/household/shared-device';
import { ONBOARDING_ROLES } from '@/lib/onboarding-prefs';

assert.equal(DEFAULT_SHARED_IPAD_NAME, 'Family iPad');
assert.equal(ONBOARDING_ROLES.find((role) => role.id === 'shared-tablet')?.title, 'Shared iPad');
assert.equal(ONBOARDING_ROLES.find((role) => role.id === 'child')?.title, 'Sidekick');
assert.ok(
  !ONBOARDING_ROLES.some((role) => /kid/i.test(role.title) || /kid/i.test(role.subtitle) || role.perks.some((p) => /kid/i.test(p)))
);
console.log('PASS shared iPad / Sidekick onboarding chrome');

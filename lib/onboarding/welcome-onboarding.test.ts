/**
 * Get Started parity: Meritocracy step, no ready Redirect, Apple premium, ready householdId.
 * Run: npx tsx lib/onboarding/welcome-onboarding.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const welcome = source('app/welcome.tsx');

assert.match(welcome, /setStep\('reward-system'\)/);
assert.match(welcome, /REWARD_MODE_COPY/);
assert.match(welcome, /Meritocracy or Equity/);
assert.equal(
  welcome.includes("if (step !== 'reward-system') return"),
  false,
  'reward-system must not auto-skip'
);
assert.equal(
  welcome.includes('stepOpacity.setValue(0)'),
  false,
  'do not zero opacity on step change'
);
assert.match(welcome, /ONBOARDING_EXIT_HOLD_STEPS/);
assert.match(welcome, /!ONBOARDING_EXIT_HOLD_STEPS\.has\(step\)/);
assert.match(welcome, /householdId: household\.id/);
assert.match(welcome, /markPremiumGatePending/);
assert.match(welcome, /premiumOnboardingHref\(\{ source: 'onboarding' \}\)/);
assert.match(welcome, /fetchEntitlement/);
assert.match(welcome, /!hydrated\.id/);
assert.match(welcome, /householdSetupMessage/);
assert.match(welcome, /Your household is saved/);

const confirm = source('app/confirm-email.tsx');
assert.match(confirm, /markPremiumGatePending/);
assert.match(confirm, /premiumOnboardingHref\(\{ source: 'onboarding' \}\)/);

const signIn = source('app/sign-in.tsx');
assert.equal(
  signIn.includes('markPremiumGatePending'),
  false,
  'returning email sign-in must not hit the premium gate'
);

const members = source('app/household-members.tsx');
assert.match(members, /householdId: household\.id/);

const repo = source('repositories/household-repository.ts');
assert.match(repo, /allocateChildInviteCode/);
assert.match(repo, /isUniqueViolation/);
assert.match(repo, /insertHouseholdInviteWithRetry/);
assert.match(repo, /allocateHouseholdInviteCode/);
assert.match(repo, /findOwnedHousehold|owner_id/);

const settings = source('app/settings.tsx');
assert.match(settings, /REWARD_MODE_COPY/);
assert.match(settings, /rewardMode: mode/);

console.log('PASS welcome-onboarding');

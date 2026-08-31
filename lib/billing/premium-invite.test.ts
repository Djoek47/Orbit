/**
 * Premium paywall skip for invite joiners.
 * Run: npx --yes tsx lib/billing/premium-invite.test.ts
 */
import assert from 'node:assert/strict';

import { shouldSkipPremiumForInvite } from './premium-invite';

async function run() {
  assert.equal(await shouldSkipPremiumForInvite(), false);
  assert.equal(await shouldSkipPremiumForInvite({ inviteParam: 'CMX-7429' }), true);
  assert.equal(await shouldSkipPremiumForInvite({ inviteParam: 'CMX-EMMA' }), true);
  assert.equal(await shouldSkipPremiumForInvite({ memberInviteParam: 'token-abc' }), true);

  console.log('premium-invite tests passed');
}

void run();

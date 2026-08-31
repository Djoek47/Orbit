/**
 * Invite kind + routing — profile CMX-EMMA vs legacy household CMX-3486.
 * Run: npx --yes tsx lib/invites/invite-intent.test.ts
 */
import assert from 'node:assert/strict';

import {
  classifyInviteCode,
  householdInviteWrongForKidMessage,
  inviteHref,
  nextInviteDestination,
} from './invite-intent';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  assert.equal(classifyInviteCode('CMX-3486'), 'household');
  assert.equal(classifyInviteCode('https://www.choremaxx.app/join/CMX-3486'), 'household');
  assert.equal(classifyInviteCode('CMX-EMMA'), 'profile');
  assert.equal(classifyInviteCode('CMX-LIAM'), 'profile');
  assert.equal(classifyInviteCode('choremaxx://join/CMX-TODD'), 'profile');
  pass('classify household digits vs kid names');
}

{
  assert.equal(
    nextInviteDestination('household', {
      isSignedIn: true,
      isPendingMember: false,
      hasHousehold: true,
    }),
    'join-household'
  );
  assert.equal(
    nextInviteDestination('household', {
      isSignedIn: false,
      isPendingMember: false,
      hasHousehold: false,
    }),
    'invite-unsupported'
  );
  assert.equal(
    nextInviteDestination('profile', {
      isSignedIn: false,
      isPendingMember: false,
      hasHousehold: false,
    }),
    'join-profile'
  );
  pass('destinations: profile vs legacy household');
}

{
  assert.equal(inviteHref('invite-unsupported', 'CMX-3486'), '/invite-unsupported?code=CMX-3486');
  assert.equal(inviteHref('join-profile', 'CMX-EMMA'), '/join-profile?code=CMX-EMMA');
  assert.match(householdInviteWrongForKidMessage('CMX-3486'), /Sidekick invite/);
  pass('hrefs + kid-field copy');
}

console.log('\ninvite-intent tests passed');

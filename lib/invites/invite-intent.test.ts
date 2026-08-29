/**
 * Invite kind + routing — household CMX-3486 vs kid CMX-EMMA.
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
      isSignedIn: true,
      isPendingMember: true,
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
    'welcome-invited'
  );
  assert.equal(
    nextInviteDestination('profile', {
      isSignedIn: false,
      isPendingMember: false,
      hasHousehold: false,
    }),
    'join-profile'
  );
  pass('destinations: logged in / pending / logged out / kid');
}

{
  assert.equal(inviteHref('welcome-invited', 'CMX-3486'), '/welcome?invite=CMX-3486');
  assert.equal(inviteHref('join-household', 'CMX-3486'), '/join-household?code=CMX-3486');
  assert.match(householdInviteWrongForKidMessage('CMX-3486'), /household invite/);
  pass('hrefs + kid-field copy');
}

console.log('\ninvite-intent tests passed');

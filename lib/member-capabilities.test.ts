/**
 * Run: npx tsx lib/member-capabilities.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildCapabilitiesDocument,
  memberMayAddGrocery,
  resolveCapabilitiesForMember,
  resolveMemberCapabilities,
} from '@/lib/member-capabilities';

const base = {
  sidekickGroceryAdd: false,
  memberCapabilities: buildCapabilitiesDocument(
    {
      allowRewardRedeem: true,
      allowSpecialRewardRequest: false,
      allowAllowance: true,
      allowGroceryAdd: false,
      allowCalendarCreate: false,
      requireSidekickEventApproval: true,
    },
    {
      emma: { allowGroceryAdd: true },
      jack: { allowCalendarCreate: true },
    }
  ),
};

assert.equal(resolveMemberCapabilities(base).allowGroceryAdd, false);
assert.equal(memberMayAddGrocery(base, 'emma'), true);
assert.equal(memberMayAddGrocery(base, 'jack'), false);
assert.equal(resolveCapabilitiesForMember(base, 'jack').allowCalendarCreate, true);
assert.equal(resolveCapabilitiesForMember(base, 'emma').allowCalendarCreate, false);

const everyoneOn = {
  sidekickGroceryAdd: true,
  memberCapabilities: buildCapabilitiesDocument(
    {
      allowRewardRedeem: true,
      allowSpecialRewardRequest: false,
      allowAllowance: true,
      allowGroceryAdd: true,
      allowCalendarCreate: false,
      requireSidekickEventApproval: true,
    },
    {
      // Emma explicitly off while Everyone is on
      emma: { allowGroceryAdd: false },
    }
  ),
};
assert.equal(memberMayAddGrocery(everyoneOn, 'jack'), true);
assert.equal(memberMayAddGrocery(everyoneOn, 'emma'), false);

const panel = readFileSync('components/orbit/settings/sidekick-permissions-panel.tsx', 'utf8');
assert.match(panel, /Everyone/);
assert.match(panel, /onMemberCapabilities/);
assert.match(panel, /setScope/);

const settings = readFileSync('app/settings.tsx', 'utf8');
assert.doesNotMatch(settings, /applyGroceryPermissionMerge/);
assert.match(settings, /updateMemberCapabilityOverrides/);

console.log('member-capabilities: ok');

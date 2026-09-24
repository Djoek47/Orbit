/**
 * WO14 §7 grocery merge tests.
 */
import assert from 'node:assert/strict';

import {
  applyGroceryPermissionMerge,
  mergeGroceryPermission,
} from '@/lib/household/migrate-grocery-permission';

{
  assert.equal(
    mergeGroceryPermission({
      sidekickGroceryAdd: true,
      allowGroceryAdd: false,
      sidekickGroceryAddWasSet: true,
      allowGroceryAddWasSet: true,
    }),
    true,
    'disagree → permissive'
  );
  assert.equal(
    mergeGroceryPermission({
      sidekickGroceryAdd: false,
      allowGroceryAdd: true,
      sidekickGroceryAddWasSet: true,
      allowGroceryAddWasSet: true,
    }),
    true,
    'disagree the other way → permissive'
  );
  assert.equal(
    mergeGroceryPermission({
      sidekickGroceryAdd: false,
      allowGroceryAdd: true,
      sidekickGroceryAddWasSet: true,
      allowGroceryAddWasSet: false,
    }),
    false,
    'only sidekick set → take sidekick'
  );
  assert.equal(
    mergeGroceryPermission({
      sidekickGroceryAdd: false,
      allowGroceryAdd: true,
      sidekickGroceryAddWasSet: false,
      allowGroceryAddWasSet: true,
    }),
    true,
    'only caps set → take caps'
  );
  console.log('PASS grocery merge cases');
}

{
  const out = applyGroceryPermissionMerge({
    sidekickGroceryAdd: false,
    memberCapabilities: {
      allowRewardRedeem: true,
      allowSpecialRewardRequest: false,
      allowAllowance: true,
      allowGroceryAdd: true,
      allowCalendarCreate: false,
      requireSidekickEventApproval: true,
    },
  });
  assert.equal(out.sidekickGroceryAdd, true);
  assert.equal(out.memberCapabilities?.allowGroceryAdd, true);
  console.log('PASS applyGroceryPermissionMerge');
}

console.log('All grocery permission tests passed.');

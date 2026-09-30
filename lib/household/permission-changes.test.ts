import assert from 'node:assert/strict';

import {
  permissionChangeSummary,
  permissionChangeTone,
  permissionChanges,
  permissionState,
} from '@/lib/household/permission-changes';

const base = permissionState({});

// Nothing moved, nothing said.
assert.deepEqual(permissionChanges(base, base), []);
assert.equal(permissionChangeTone([]), 'none');
assert.equal(permissionChangeSummary([]), '');

// Turning the grocery list on is reported once, not twice, even though two switches carry it.
const groceryOn = permissionState({
  memberCapabilities: { allowGroceryAdd: true },
  sidekickGroceryAdd: true,
});
const onChanges = permissionChanges(base, groceryOn);
assert.equal(onChanges.length, 1, 'one line for the grocery pair');
assert.equal(onChanges[0]!.granted, true);
assert.match(onChanges[0]!.message, /add to the grocery list/i);
assert.equal(permissionChangeTone(onChanges), 'granted');

// Taking something away reads as off, and is amber.
const offChanges = permissionChanges(groceryOn, base);
assert.equal(offChanges[0]!.granted, false);
assert.match(offChanges[0]!.message, /off for now/i);
assert.equal(permissionChangeTone(offChanges), 'removed');

// Several at once: granted wins the colour, and the summary counts both sides.
const mixed = permissionChanges(
  permissionState({ memberCapabilities: { allowAllowance: true, allowRewardRedeem: true } }),
  permissionState({
    memberCapabilities: { allowAllowance: false, allowCalendarCreate: true },
  })
);
assert.equal(mixed.length, 2, 'allowance off, calendar on');
assert.equal(permissionChangeTone(mixed), 'granted');
assert.match(permissionChangeSummary(mixed), /changed/);

// All removed.
const allOff = permissionChanges(
  permissionState({ memberCapabilities: { allowAllowance: true, allowCalendarCreate: true } }),
  permissionState({})
);
assert.equal(permissionChangeTone(allOff), 'removed');
assert.match(permissionChangeSummary(allOff), /off for now/);

// Every line is written for the kid, never for the admin.
for (const change of [...onChanges, ...offChanges, ...mixed]) {
  assert.ok(!/sidekick/i.test(change.message), `"${change.message}" talks about them, not to them`);
}

console.log('permission-changes: ok');

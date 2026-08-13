import assert from 'node:assert/strict';

import { isPersistedHouseholdId } from './persisted-household-id';

assert.equal(isPersistedHouseholdId(null), false);
assert.equal(isPersistedHouseholdId(undefined), false);
assert.equal(isPersistedHouseholdId(''), false);
assert.equal(isPersistedHouseholdId('hh-rivera'), false, 'demo household is not a live uuid');
assert.equal(isPersistedHouseholdId('hh-mock'), false);
assert.equal(
  isPersistedHouseholdId('6f1c2e90-4b3a-4d21-9c8e-1a2b3c4d5e6f'),
  true,
  'supabase household ids are uuids'
);

console.log('isPersistedHouseholdId: ok');

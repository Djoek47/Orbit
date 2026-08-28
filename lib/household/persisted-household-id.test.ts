import assert from 'node:assert/strict';

import {
  isPersistedHouseholdId,
  assertHouseholdUuid,
  InvalidHouseholdIdError,
  liveHouseholdIdOrThrow,
} from './persisted-household-id';

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

{
  let threw = false;
  try {
    assertHouseholdUuid('rewardsRepository.getRedemptions', 'hh-rivera');
  } catch (error) {
    threw = error instanceof InvalidHouseholdIdError;
    assert.match((error as Error).message, /rewardsRepository.getRedemptions/);
    assert.match((error as Error).message, /hh-rivera/);
  }
  assert.equal(threw, true, 'A0.3 slug throws typed developer error');
  assert.equal(liveHouseholdIdOrThrow('rewardsRepository.getRewards', 'hh-rivera', false), 'hh-rivera');
  let liveThrew = false;
  try {
    liveHouseholdIdOrThrow('rewardsRepository.getRewards', 'hh-rivera', true);
  } catch (error) {
    liveThrew = error instanceof InvalidHouseholdIdError;
  }
  assert.equal(liveThrew, true);
}

console.log('isPersistedHouseholdId: ok');

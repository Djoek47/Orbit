/**
 * Run: npx --yes tsx lib/household/whos-on-people.test.ts
 */
import assert from 'node:assert/strict';

import { whosOnPeople } from '@/lib/household/whos-on-people';
import type { HouseholdMember } from '@/types/orbit';

const member = (
  id: string,
  name: string,
  role: HouseholdMember['role'],
  extra: Partial<HouseholdMember> = {}
): HouseholdMember =>
  ({
    id,
    name,
    role,
    status: 'active',
    avatar: name.charAt(0),
    ...extra,
  }) as HouseholdMember;

const jack = member('j', 'Jack', 'child');
const emma = member('e', 'Emma', 'child');
const pad = member('p', 'Shared device', 'shared-device', {
  sharedWithMemberIds: ['j', 'e'],
});

{
  const people = whosOnPeople({
    members: [jack, emma, pad],
    currentMemberId: 'j',
    hostedMemberIds: ['j', 'e'],
  });
  assert.equal(people.length, 2);
  assert.deepEqual(
    people.map((p) => p.name),
    ['Jack', 'Emma']
  );
}

{
  const people = whosOnPeople({
    members: [jack, emma, pad],
    currentMemberId: 'j',
  });
  assert.equal(people.length, 2, 'falls back to shared device roster');
}

console.log('whos-on-people: ok');

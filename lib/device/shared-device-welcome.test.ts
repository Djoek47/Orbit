import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  describePeople,
  householdMatchCode,
  sharedDeviceWelcome,
} from './shared-device-welcome';
import type { HouseholdMember } from '../../types/orbit';

function person(id: string, name: string): HouseholdMember {
  return {
    id,
    name,
    role: 'sidekick',
    status: 'active',
    avatar: '',
    xp: 0,
    loadShare: 0,
  } as unknown as HouseholdMember;
}

function shell(ids: string[]): HouseholdMember {
  return {
    id: 'shell-1',
    name: 'Kitchen tablet',
    role: 'shared-device',
    status: 'active',
    sharedWithMemberIds: ids,
    avatar: '',
    xp: 0,
    loadShare: 0,
  } as unknown as HouseholdMember;
}

// ── Match code ────────────────────────────────────────────────────────────────
// Both ends compute it from the household id alone, so it has to be stable.
assert.equal(householdMatchCode('house-abc'), householdMatchCode('house-abc'));
assert.notEqual(householdMatchCode('house-abc'), householdMatchCode('house-abd'));
assert.equal(householdMatchCode('house-abc').length, 4);
assert.equal(householdMatchCode(null), '----', 'no household yet reads as blank, not as a code');
assert.equal(householdMatchCode(''), '----');

// Nothing in the alphabet that two tired people could read differently across a kitchen.
for (const seed of ['a', 'household-1', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'zzz']) {
  assert.doesNotMatch(householdMatchCode(seed), /[OI01S5B8]/, `${seed} avoids lookalike glyphs`);
}

// ── Naming who is on it ───────────────────────────────────────────────────────
assert.equal(describePeople([]), '');
assert.equal(describePeople([person('a', 'Emma')]), 'Emma');
assert.equal(describePeople([person('a', 'Emma'), person('b', 'Jack')]), 'Emma and Jack');
assert.equal(
  describePeople([person('a', 'Emma'), person('b', 'Jack'), person('c', 'Noah')]),
  'Emma, Jack and 1 other'
);
assert.equal(
  describePeople([
    person('a', 'Emma'),
    person('b', 'Jack'),
    person('c', 'Noah'),
    person('d', 'Lea'),
  ]),
  'Emma, Jack and 2 others'
);
// First names only — a full name would wrap the card on a phone.
assert.equal(describePeople([person('a', 'Emma Mugabo')]), 'Emma');

// ── The whole card ────────────────────────────────────────────────────────────
const members = [person('a', 'Emma'), person('b', 'Jack'), shell(['a', 'b'])];
const card = sharedDeviceWelcome({
  householdId: 'house-abc',
  householdName: 'The Mugabos',
  shell: shell(['a', 'b']),
  members,
});
assert.equal(card.householdName, 'The Mugabos');
assert.equal(card.peopleLabel, 'Emma and Jack');
assert.equal(card.people.length, 2);
assert.equal(card.full, false);
assert.equal(card.matchCode, householdMatchCode('house-abc'));
// "tablet" never reaches the screen — the device may well be a phone.
assert.doesNotMatch(card.deviceLabel, /tablet|iPad/i);

const noName = sharedDeviceWelcome({
  householdId: 'h',
  householdName: '   ',
  shell: null,
  members: [],
});
assert.equal(noName.householdName, 'your household', 'never renders an empty title');
assert.equal(noName.people.length, 0);
assert.equal(noName.peopleLabel, '');

// Six is the cap the picker lays out; a seventh must not reach it.
const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const crowd = sharedDeviceWelcome({
  householdId: 'h',
  householdName: 'Big house',
  shell: shell(many),
  members: [...many.map((id, i) => person(id, `P${i}`)), shell(many)],
});
assert.equal(crowd.people.length, 6);
assert.equal(crowd.full, true);

// ── The screens themselves ────────────────────────────────────────────────────
const read = (p: string) => readFileSync(p, 'utf8');
const join = read('app/join-profile.tsx');

// The question the QR already answered, and the sentence nobody could parse.
assert.doesNotMatch(join, /Which device\?/, 'the device question is gone');
assert.doesNotMatch(join, /is on a shared tablet/, 'and its title with it');
assert.doesNotMatch(join, /Sidekick phone<\/|Continue as \{who\}/, 'no "Emma\'s Sidekick phone"');
assert.match(join, /SharedDeviceWelcomeCard/, 'the welcome card replaces it');

const welcome = read('components/orbit/device/shared-device-welcome-card.tsx');
assert.match(welcome, /matchCode/, 'the household code is shown');
assert.match(welcome, /FadeIn|withTiming|withDelay/, 'it animates rather than snapping in');

const picker = read('components/orbit/shared-device-profile-picker.tsx');
assert.match(picker, /selectedId/, 'the picker knows which face was tapped');
assert.match(picker, /FadeInDown|withDelay/, 'faces arrive one after another');

console.log('shared-device-welcome: ok');

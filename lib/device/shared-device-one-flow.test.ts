/**
 * One way onto a shared device, and every face on it opens.
 *
 * The bug this pins: the wizard's QR joined the tablet as one child, People showed the device
 * empty, and a personal code joined the device but saved one child's session — so every other
 * face failed with "is not on this tablet yet".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  deviceCodes,
  rosterFromMembers,
  sharedDeviceHrefForCode,
} from './shared-device-join';
import { continueSharedDeviceLabel, isUsableResume } from './shared-device-resume';
import { welcomeFromPeople } from './shared-device-welcome';
import { parseSharedDeviceInvitePayload } from '@/lib/household/shared-device-invite';
import type { HouseholdMember } from '@/types/orbit';

const member = (id: string, name: string, code?: string): HouseholdMember =>
  ({
    id,
    name,
    role: 'child',
    status: 'active',
    avatar: name[0]!,
    xp: 0,
    loadShare: 0,
    profileInviteCode: code,
  }) as HouseholdMember;
const shell = {
  ...member('dev', 'Kitchen'),
  role: 'shared-device',
  sharedWithMemberIds: ['jack', 'emma'],
} as HouseholdMember;
const members = [member('jack', 'Jack', 'CMX-JACK'), member('emma', 'Emma', 'CMX-EMMA'), shell];

// ── A personal code on a shared device becomes the device's link ─────────────
const roster = rosterFromMembers('jack', members);
assert.ok(roster);
assert.deepEqual(roster.people.map((p) => p.name), ['Jack', 'Emma']);
assert.deepEqual(deviceCodes('CMX-JACK', roster), ['CMX-JACK', 'CMX-EMMA'], 'everyone, once each');
assert.deepEqual(deviceCodes('CMX-JACK', null), ['CMX-JACK'], 'the scanned code is never lost');

const href = sharedDeviceHrefForCode('CMX-JACK', roster);
assert.match(href, /^\/join-shared-device\?/);
const payload = decodeURIComponent(/payload=([^&]+)/.exec(href)![1]!);
assert.deepEqual(parseSharedDeviceInvitePayload(payload)?.codes.sort(), ['CMX-EMMA', 'CMX-JACK']);
assert.match(href, /personal=CMX-JACK/, 'and still offers "use as Jack\'s own"');
assert.match(href, /deviceId=dev/);

assert.equal(rosterFromMembers('nobody', members), null);

// ── The card names everyone before anyone joins ──────────────────────────────
const card = welcomeFromPeople({
  householdId: 'hh-1',
  householdName: 'The Nero Home',
  deviceLabel: 'Tester',
  people: [members[0]!, members[1]!, members[0]!],
});
assert.equal(card.people.length, 2, 'duplicates collapse');
assert.equal(card.peopleLabel, 'Jack and Emma');
assert.equal(card.householdName, 'The Nero Home');
assert.equal(card.hasMatchCode, true);

// ── Signing out offers the device back, not one child ────────────────────────
assert.equal(
  continueSharedDeviceLabel({ householdName: 'The Nero Home' }),
  'Continue with The Nero Home shared device'
);
assert.equal(continueSharedDeviceLabel({ householdName: ' ' }), 'Continue with this shared device');
assert.equal(isUsableResume({ householdName: 'X', memberIds: [] }), false, 'nobody to resume');
assert.equal(isUsableResume({ householdName: 'X', memberIds: ['jack'] }), true);

// ── Wiring ───────────────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(p, 'utf8');

// The scanner used to cut a shared-device QR down to its first code.
const scanner = read('components/orbit/invite-qr-scanner.tsx');
assert.match(scanner, /if \(parseSharedDeviceInvitePayload\(data\)\)[\s\S]*?onScanned\(data\.trim\(\)\)/);

// The wizard saved who is on the device by looking it up in a roster that did not have it yet.
const wizard = read('app/setup-kid-device.tsx');
assert.match(wizard, /await updateSharedDeviceLinks\(\s*shell\.id,[\s\S]*?shell\s*\)/);
const store = read('store/orbit-store.tsx');
assert.match(store, /deviceHint\?\.id === deviceId \? deviceHint : undefined/);
assert.doesNotMatch(
  store,
  /if \(!device \|\| device\.role !== 'shared-device'\) \{\s*return;\s*\}\s*const updated = await householdRepository\.updateSharedDeviceLinks/,
  'a missing device is an error, not a silent no-op'
);

// A personal code for someone on a shared device goes to the one device screen.
const personal = read('app/join-profile.tsx');
assert.match(personal, /sharedDeviceHrefForCode\(parsed, roster\)/);

// Sign-out on a shared tablet keeps everyone and remembers the device.
assert.match(store, /saveSharedDeviceResume\(\{/);
const welcome = read('app/welcome.tsx');
assert.match(welcome, /continueSharedDeviceLabel\(sharedResume\)/);
assert.match(welcome, /router\.replace\('\/select-profile' as never\)/, 'and resumes on the faces');

// The server tells a tablet who else is on the device.
const fn = read('supabase/functions/redeem-profile-invite/index.ts');
assert.match(fn, /sharedDevice,/);

console.log('shared-device-one-flow: ok');

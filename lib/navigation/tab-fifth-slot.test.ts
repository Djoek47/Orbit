/**
 * The tab bar's fifth slot, and the device binding that survives a sign-out.
 * Run: npx tsx lib/navigation/tab-fifth-slot.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { tabFifthSlot } from '@/lib/navigation/tab-fifth-slot';
import type { HouseholdMember } from '@/types/orbit';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const person = (id: string, name: string, role: string): HouseholdMember =>
  ({ id, name, role, status: 'active' }) as unknown as HouseholdMember;

const owner = person('o', 'Cisse', 'owner');
const jack = person('m1', 'Jack', 'child');
const ama = person('m2', 'Ama', 'child');
const ipad = {
  ...person('d', 'Kitchen iPad', 'shared-device'),
  sharedWithMemberIds: ['m2'],
} as HouseholdMember;
const members = [owner, jack, ama, ipad];

// An adult on their own phone keeps Poppins.
assert.equal(tabFifthSlot({ role: 'owner', members, memberId: 'o' }), 'poppins');
assert.equal(tabFifthSlot({ role: 'admin', members, memberId: 'o' }), 'poppins');

// A Sidekick's own phone: four tabs, no fifth button to nowhere.
assert.equal(tabFifthSlot({ role: 'child', members, memberId: 'm1' }), 'none');

// On a shared iPad, the fifth button hands it over — for the device and for whoever is on it.
assert.equal(tabFifthSlot({ role: 'shared-device', members, memberId: 'd' }), 'switch');
assert.equal(tabFifthSlot({ role: 'child', members, memberId: 'm2' }), 'switch');

// The bar and the layout agree.
const bar = read('components/orbit/make-tab-bar.tsx');
assert.match(bar, /fifthSlot !== 'poppins'/, 'the Poppins tab goes when the slot is not it');
assert.match(bar, /fifthSlot === 'switch'/, 'and the switcher takes its place');
assert.match(bar, /markNeedsProfilePick/, 'which opens the face picker');
assert.match(read('app/(tabs)/_layout.tsx'), /tabFifthSlot\(/, 'the layout uses the same rule');

// Live Poppins wears the chosen voice colour, wherever you are.
assert.match(bar, /poppinsBusy/, 'the bar knows a session is running');
assert.match(bar, /poppinsVoice\(prefs\.voiceId\)\.color/, 'in the household’s chosen colour');
assert.match(bar, /poppinsBusy\s*\?\s*\(\[poppinsTone/, 'and paints the button with it');

// Signing out unbinds the device; signing in clears the last Sidekick.
const store = read('store/orbit-store.tsx');
assert.match(store, /clearDeviceSession\(\)\s*\n?\s*\);/, 'sign-out clears the device session');
assert.doesNotMatch(store, /skipProfilePick/, 'no path leaves the binding behind');
const signIn = store.slice(store.indexOf('const signIn = async'), store.indexOf('const signUp = async'));
assert.match(signIn, /clearSidekickSession\(\)/, 'a new sign-in drops the old Continue-as card');
assert.match(signIn, /clearDeviceSession\(\)/, 'and the shared-tablet binding with it');

console.log('tab-fifth-slot: ok');

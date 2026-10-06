/**
 * The tab bar's fifth slot, and the device binding that survives a sign-out.
 * Run: npx tsx lib/navigation/tab-fifth-slot.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isSharedTabletDeviceSession } from '@/lib/device/device-session';
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

// An adult on their own phone keeps Poppins — even if a shared-tablet session leaked in.
assert.equal(tabFifthSlot({ role: 'owner', members, memberId: 'o' }), 'poppins');
assert.equal(tabFifthSlot({ role: 'admin', members, memberId: 'o' }), 'poppins');
assert.equal(
  tabFifthSlot({ role: 'owner', members, memberId: 'o', sharedTabletSession: true }),
  'poppins',
  'admin never inherits Switch from a leftover shared-tablet binding'
);

// A Sidekick's own phone: four tabs, no fifth button to nowhere.
assert.equal(tabFifthSlot({ role: 'child', members, memberId: 'm1' }), 'none');

// Hosted on a shared tablet locally — even when the roster has not linked sharedWithMemberIds yet.
assert.equal(
  tabFifthSlot({ role: 'child', members, memberId: 'm1', sharedTabletSession: true }),
  'switch'
);
assert.equal(
  isSharedTabletDeviceSession({
    mode: 'shared',
    hostKind: 'shared-tablet',
    profileMemberIds: ['m1', 'm2'],
    activeMemberId: 'm1',
    needsProfilePick: false,
    sharedDeviceId: 'd',
  }),
  true
);
assert.equal(
  isSharedTabletDeviceSession({
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['m1'],
    activeMemberId: 'm1',
    needsProfilePick: false,
    sharedDeviceId: null,
  }),
  false
);
assert.equal(
  isSharedTabletDeviceSession({
    mode: 'shared',
    hostKind: 'sidekick',
    profileMemberIds: ['m1', 'm2'],
    activeMemberId: 'm1',
    needsProfilePick: false,
    sharedDeviceId: null,
  }),
  true,
  'two hosted profiles use Switch UX'
);

// Shared-device shell → Switch. A child linked to that iPad on their *own* phone → no Switch.
assert.equal(tabFifthSlot({ role: 'shared-device', members, memberId: 'd' }), 'switch');
assert.equal(
  tabFifthSlot({ role: 'child', members, memberId: 'm2' }),
  'none',
  'roster link alone must not turn a personal Sidekick phone into Switch'
);
assert.equal(
  tabFifthSlot({ role: 'child', members, memberId: 'm2', sharedTabletSession: true }),
  'switch',
  'only a real shared-tablet session gets Switch'
);

// The bar and the layout agree.
const bar = read('components/orbit/make-tab-bar.tsx');
assert.match(bar, /fifthSlot !== 'poppins'/, 'the Poppins tab goes when the slot is not it');
assert.match(bar, /fifthSlot === 'switch'/, 'and the switcher takes its place');
assert.match(bar, /SwitchPeopleIcon/, 'Switch glyph mounts in the fifth slot');
assert.match(bar, /^\s*Switch\s*$/m, 'Switch label is visible under the glyph');
assert.match(bar, /markNeedsProfilePick/, 'which opens the face picker');
assert.match(read('lib/refresh/use-home-live-refresh.ts'), /useHomeLiveRefresh/, 'Home has a live refresh hook');
assert.match(read('app/(tabs)/index.tsx'), /useHomeLiveRefresh/, 'Home wires the live refresh');
assert.match(read('app/(tabs)/_layout.tsx'), /useTabFifthSlot\(/, 'the layout uses the same rule');
assert.match(read('components/orbit/make-tab-bar.tsx'), /useTabFifthSlot\(/, 'the tab bar uses the same hook');

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

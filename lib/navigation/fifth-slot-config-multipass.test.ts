/**
 * Multipass — fifth tab slot across admin / sidekick / shared-device configs.
 * Run: npx --yes tsx lib/navigation/fifth-slot-config-multipass.test.ts
 *
 * Contract (product):
 *   admin personal phone     → 5 tabs, Poppins (never Switch)
 *   sidekick personal phone  → 4 tabs (never Poppins, never Switch)
 *   shared tablet session    → 5 tabs, Switch
 *   sidekick also on tablet  → personal phone stays 4 tabs; tablet gets Switch
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isSharedTabletDeviceSession } from '@/lib/device/device-session';
import {
  profilesForSharedDeviceSwitch,
  resolveSwitchDeviceShell,
} from '@/lib/device/profiles-for-switch';
import { tabFifthSlot } from '@/lib/navigation/tab-fifth-slot';
import { canShowPoppinsTab } from '@/lib/sidekick/permissions';
import { memberSettingsModel } from '@/lib/settings/member-settings-model';
import type { DeviceSession } from '@/lib/device/device-session';
import type { HouseholdMember } from '@/types/orbit';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const person = (id: string, name: string, role: string, extra: Partial<HouseholdMember> = {}) =>
  ({ id, name, role, status: 'active', xp: 0, avatar: '', ...extra }) as HouseholdMember;

const nero = person('o', 'Nero', 'owner');
const admin2 = person('a', 'Ada', 'admin');
const emma = person('e', 'Emma', 'child');
const jack = person('j', 'Jack', 'child');
const ipad = person('d', 'Kitchen iPad', 'shared-device', {
  sharedWithMemberIds: ['e', 'j'],
});
const members = [nero, admin2, emma, jack, ipad];

const sidekickSession: DeviceSession = {
  mode: 'shared',
  hostKind: 'sidekick',
  profileMemberIds: ['e'],
  activeMemberId: 'e',
  needsProfilePick: false,
  sharedDeviceId: null,
  deviceLabel: "Emma's phone",
};

const tabletSession: DeviceSession = {
  mode: 'shared',
  hostKind: 'shared-tablet',
  profileMemberIds: ['e', 'j'],
  activeMemberId: 'j',
  needsProfilePick: false,
  sharedDeviceId: 'd',
  deviceLabel: 'Kitchen iPad',
};

// ── Pass A: Admin personal → Poppins ─────────────────────────────────────────
{
  assert.equal(tabFifthSlot({ role: 'owner', members, memberId: 'o' }), 'poppins');
  assert.equal(tabFifthSlot({ role: 'admin', members, memberId: 'a' }), 'poppins');
  assert.equal(
    tabFifthSlot({ role: 'owner', members, memberId: 'o', sharedTabletSession: true }),
    'poppins',
    'admin never Switch even if tablet binding leaked'
  );
  assert.equal(canShowPoppinsTab({ role: 'owner' }), true);
  assert.equal(canShowPoppinsTab({ role: 'admin' }), true);
  assert.equal(canShowPoppinsTab({ role: 'owner', sidekickPoppinsAi: false }), true);
}

// ── Pass B: Sidekick personal → 4 tabs, no Poppins, no Switch ────────────────
{
  assert.equal(tabFifthSlot({ role: 'child', members, memberId: 'e' }), 'none');
  assert.equal(canShowPoppinsTab({ role: 'child' }), false);
  assert.equal(canShowPoppinsTab({ role: 'sidekick' }), false);
  assert.equal(canShowPoppinsTab({ role: 'child', sidekickPoppinsAi: true }), false);
  assert.equal(isSharedTabletDeviceSession(sidekickSession), false);
  assert.equal(resolveSwitchDeviceShell(sidekickSession, members), undefined);
  assert.deepEqual(
    profilesForSharedDeviceSwitch(sidekickSession, members).map((m) => m.id),
    ['e']
  );
  const settings = memberSettingsModel({
    member: emma,
    members,
    onSharedTablet: false,
  })!;
  assert.equal(settings.kind, 'sidekick');
  assert.equal(settings.canSwitchProfiles, false);
}

// ── Pass C: Shared tablet → Switch (5 tabs) ──────────────────────────────────
{
  assert.equal(
    tabFifthSlot({ role: 'child', members, memberId: 'j', sharedTabletSession: true }),
    'switch'
  );
  assert.equal(tabFifthSlot({ role: 'shared-device', members, memberId: 'd' }), 'switch');
  assert.equal(isSharedTabletDeviceSession(tabletSession), true);
  assert.equal(resolveSwitchDeviceShell(tabletSession, members)?.id, 'd');
  assert.deepEqual(
    profilesForSharedDeviceSwitch(tabletSession, members).map((m) => m.name).sort(),
    ['Emma', 'Jack']
  );
  const onTablet = memberSettingsModel({
    member: jack,
    members,
    onSharedTablet: true,
  })!;
  assert.equal(onTablet.kind, 'shared-account');
  assert.equal(onTablet.canSwitchProfiles, true);
}

// ── Pass D: Emma has own Sidekick phone AND is linked to Kitchen iPad ────────
{
  // On her phone: 4 tabs
  assert.equal(
    tabFifthSlot({
      role: 'child',
      members,
      memberId: 'e',
      sharedTabletSession: isSharedTabletDeviceSession(sidekickSession),
    }),
    'none'
  );
  // On the tablet as Emma: Switch
  assert.equal(
    tabFifthSlot({
      role: 'child',
      members,
      memberId: 'e',
      sharedTabletSession: isSharedTabletDeviceSession(tabletSession),
    }),
    'switch'
  );
  // Settings on phone must not offer Switch
  assert.equal(
    memberSettingsModel({ member: emma, members, onSharedTablet: false })!.canSwitchProfiles,
    false
  );
}

// ── Pass E: Wiring — Poppins back for admin, Switch for tablet, never Sidekick
{
  const bar = read('components/orbit/make-tab-bar.tsx');
  assert.match(bar, /memberRole === 'owner' \|\| memberRole === 'admin' \? 'poppins'/);
  assert.match(bar, /demoteSharedSessionForPersonalAdmin/);
  assert.match(bar, /fifthSlot === 'switch'/);
  assert.match(bar, /SwitchPeopleIcon/);

  const layout = read('app/(tabs)/_layout.tsx');
  assert.match(layout, /canShowPoppinsTab/);
  assert.match(layout, /fifthSlot === 'poppins'/);
  assert.match(
    layout,
    /currentMember\?\.role === 'owner' \|\| currentMember\?\.role === 'admin'/,
    'layout forces Poppins for admin'
  );

  const sessionSrc = read('lib/device/device-session.ts');
  assert.match(sessionSrc, /expandFromRoster/);
  assert.match(sessionSrc, /hostKind === 'sidekick'/);
  assert.match(sessionSrc, /Personal Sidekick host/);

  const shellSrc = read('lib/device/profiles-for-switch.ts');
  assert.match(shellSrc, /hostKind === 'sidekick' && !session\.sharedDeviceId/);

  const sidekickSettings = read('components/orbit/sidekick-settings-screen.tsx');
  assert.match(sidekickSettings, /onSharedTablet/);
  assert.match(sidekickSettings, /isSharedTabletDeviceSession/);

  const menu = read('components/orbit/shared-device-switch-menu.tsx');
  assert.match(menu, /isPersonalAdmin/);
  assert.match(menu, /demoteSharedSessionForPersonalAdmin/);
}

// ── Pass F: Connect / disconnect contracts still wired ───────────────────────
{
  const store = read('store/orbit-store.tsx');
  assert.match(store, /connectSharedTabletProfiles|hostProfileOnDevice/);
  assert.match(store, /clearDeviceSession/);
  assert.match(store, /markPresenceDisconnected/);

  const manage = read('components/orbit/members/shared-device-manage-card.tsx');
  assert.match(manage, /Who can use it/);
  assert.doesNotMatch(manage, />On this device</);

  const leave = read('lib/household/mark-presence-disconnected.ts');
  assert.match(leave, /Disconnected|disconnected/i);
}

console.log('fifth-slot-config-multipass: ok');

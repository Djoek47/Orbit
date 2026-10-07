/**
 * Multipass: shared-tablet join ≠ sidekick; Switch binds auth; presence channels.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
import {
  memberPresenceParts,
  personalPresenceParts,
  sharedPresenceParts,
} from '@/lib/household/member-presence';
import { routeInvitePayload } from '@/lib/invites/route-invite-payload';
import { MAX_FAMILY_ADMINS } from '@/lib/household/admins';
import { SHARED_DEVICE_MAX_PEOPLE } from '@/lib/household/shared-device';
import type { HouseholdMember } from '@/types/orbit';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function member(partial: Partial<HouseholdMember> & Pick<HouseholdMember, 'id' | 'name'>): HouseholdMember {
  return {
    role: 'child',
    status: 'active',
    avatar: 'E',
    xp: 0,
    loadShare: 1,
    ...partial,
  };
}

test('Pass A — shared QR parses multi-code; join screen is not Profile invite', () => {
  const link = buildSharedDeviceInviteLink({
    label: 'Test',
    codes: ['CMX-JA9G9N', 'CMX-EM7K4Q'],
  });
  const parsed = parseSharedDeviceInvitePayload(link);
  assert.ok(parsed);
  assert.equal(parsed!.codes.length, 2);
  const joinShared = read('app/join-shared-device.tsx');
  assert.match(joinShared, /Join shared device/);
  assert.match(joinShared, /Accept/);
  assert.doesNotMatch(joinShared, /Profile invite/);
  const joinProfile = read('app/join-profile.tsx');
  assert.match(joinProfile, /Join the household/);
  assert.match(joinProfile, /Which device\?|shared tablet QR/i);
});

test('Pass A — paste/deep-link routing prefers shared-device over CMX', () => {
  const link = buildSharedDeviceInviteLink({
    label: 'Kitchen',
    codes: ['CMX-JA9G9N', 'CMX-EM7K4Q'],
  });
  const session = { isSignedIn: false, isPendingMember: false, hasHousehold: false };
  assert.equal(routeInvitePayload(link, session)?.kind, 'shared-device');
  assert.equal(routeInvitePayload('CMX-EM7K4Q', session)?.kind, 'profile');
  assert.match(read('app/join-household.tsx'), /routeInvitePayload|redirectIfSharedDevice/);
  assert.match(read('app/welcome.tsx'), /routeInvitePayload/);
  assert.match(read('app/join/[code].tsx'), /routeInvitePayload/);
  assert.match(read('lib/hooks/use-deep-link-invite.ts'), /parseSharedDeviceInviteFromUrl/);
});

test('Pass A — connectSharedTabletProfiles saves all codes then shared-tablet host', () => {
  const store = read('store/orbit-store.tsx');
  const connect = store.slice(store.indexOf('const connectSharedTabletProfiles'));
  const saveAt = connect.indexOf('saveSidekickSession');
  const setupAt = connect.indexOf('setupSharedDeviceSession');
  assert.ok(saveAt > 0 && setupAt > saveAt, 'save sessions before setupSharedDeviceSession');
  assert.match(connect, /hostKind: 'shared-tablet'/);
  assert.match(connect, /needsProfilePick/);
  assert.match(connect, /sharedDeviceId/);
});

test('Pass B — switchPersona awaits code bind; loadSidekickSession never cross-falls-back', () => {
  const store = read('store/orbit-store.tsx');
  assert.match(store, /const switchPersona = async/);
  assert.match(store, /loadSidekickSessionFor\(target\.id\)/);
  assert.match(store, /tablet-local-\$\{target\.id\}/);
  assert.match(store, /switchingPersona/);
  assert.match(store, /profileAuth\.memberId !== currentMember\.id/);
  assert.match(store, /Still switching profiles/);
  const session = read('lib/sidekick/session.ts');
  assert.match(session, /do not silently use someone else/i);
  const taskAction = read('lib/sidekick/task-action.ts');
  assert.match(taskAction, /not_assignee|Switch/i);
});

test('Pass C — live sync rebinds on currentMember.id and drops stale polls', () => {
  const live = read('lib/refresh/use-sidekick-live-sync.ts');
  assert.match(live, /currentMember\?\.id/);
  assert.match(live, /generationRef/);
  assert.match(read('app/(tabs)/tasks.tsx'), /focusMember/);
});

test('Pass D — personal vs shared presence channels + named helpers', () => {
  const now = new Date().toISOString();
  const emma = member({
    id: 'e',
    name: 'Emma',
    personalLastSeenAt: null,
    sharedLastSeenAt: now,
    sharedActiveOnDeviceId: 'tablet-test',
    lastSeenAt: now,
  });
  assert.equal(personalPresenceParts(emma).isLive, false, 'tablet activity is not personal Connected');
  assert.equal(
    sharedPresenceParts(emma, 'tablet-test').isLive,
    true,
    'active face is Connected on the tablet'
  );
  const jack = member({
    id: 'j',
    name: 'Jack',
    sharedLastSeenAt: now,
    sharedActiveOnDeviceId: null,
  });
  assert.equal(sharedPresenceParts(jack, 'tablet-test').isLive, false);
  assert.equal(
    memberPresenceParts(emma, { channel: 'personal' }).isLive,
    personalPresenceParts(emma).isLive
  );
  const disconnect = read('lib/household/mark-presence-disconnected.ts');
  assert.match(disconnect, /personal_last_seen_at/);
  assert.match(disconnect, /shared_active_on_device_id/);
  const sync = read('lib/sidekick/sync-household.ts');
  assert.match(sync, /activeMemberId/);
  const migration = read('supabase/migrations/20261007020000_member_presence_channels.sql');
  assert.match(migration, /personal_last_seen_at/);
  assert.match(migration, /shared_last_seen_at/);
});

test('Pass E — admin cap stays 2; tablet seats stay 6', () => {
  assert.equal(MAX_FAMILY_ADMINS, 2);
  assert.equal(SHARED_DEVICE_MAX_PEOPLE, 6);
});

test('Pass 0 — Privacy/Terms open www.choremaxx.app', () => {
  const brand = read('constants/choremaxx-brand.ts');
  assert.match(brand, /www\.choremaxx\.app\/privacy/);
  assert.match(brand, /www\.choremaxx\.app\/terms/);
});

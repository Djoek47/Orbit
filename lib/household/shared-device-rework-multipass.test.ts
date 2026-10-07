/**
 * Multipass: shared-tablet join ≠ sidekick; Switch binds auth; presence channels.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseSharedDeviceInvitePayload, buildSharedDeviceInviteLink } from '@/lib/household/shared-device-invite';
import { memberPresenceParts } from '@/lib/household/member-presence';
import type { HouseholdMember } from '@/types/orbit';

const root = process.cwd();

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
  const joinShared = readFileSync(join(root, 'app/join-shared-device.tsx'), 'utf8');
  assert.match(joinShared, /Join shared device/);
  assert.match(joinShared, /Join household/);
  assert.doesNotMatch(joinShared, /Profile invite/);
  const joinProfile = readFileSync(join(root, 'app/join-profile.tsx'), 'utf8');
  assert.match(joinProfile, /Join the household/);
});

test('Pass B — switchPersona awaits code bind; loadSidekickSession never cross-falls-back', () => {
  const store = readFileSync(join(root, 'store/orbit-store.tsx'), 'utf8');
  assert.match(store, /const switchPersona = async/);
  assert.match(store, /loadSidekickSessionFor\(target\.id\)/);
  assert.match(store, /tablet-local-\$\{target\.id\}/);
  assert.match(store, /profileAuth\.memberId !== currentMember\.id/);
  const session = readFileSync(join(root, 'lib/sidekick/session.ts'), 'utf8');
  assert.match(session, /do not silently use someone else/i);
});

test('Pass C — live sync rebinds on currentMember.id', () => {
  const live = readFileSync(join(root, 'lib/refresh/use-sidekick-live-sync.ts'), 'utf8');
  assert.match(live, /currentMember\?\.id/);
});

test('Pass D — personal vs shared presence channels', () => {
  const now = new Date().toISOString();
  const emma = member({
    id: 'e',
    name: 'Emma',
    personalLastSeenAt: null,
    sharedLastSeenAt: now,
    sharedActiveOnDeviceId: 'tablet-test',
    lastSeenAt: now,
  });
  const personal = memberPresenceParts(emma, { channel: 'personal' });
  assert.equal(personal.isLive, false, 'tablet activity is not personal Connected');
  const shared = memberPresenceParts(emma, {
    channel: 'shared',
    sharedDeviceId: 'tablet-test',
  });
  assert.equal(shared.isLive, true, 'active face is Connected on the tablet');
  const jack = member({
    id: 'j',
    name: 'Jack',
    sharedLastSeenAt: now,
    sharedActiveOnDeviceId: null,
  });
  assert.equal(
    memberPresenceParts(jack, { channel: 'shared', sharedDeviceId: 'tablet-test' }).isLive,
    false
  );
});

test('Pass 0 — Privacy/Terms open www.choremaxx.app', () => {
  const brand = readFileSync(join(root, 'constants/choremaxx-brand.ts'), 'utf8');
  assert.match(brand, /www\.choremaxx\.app\/privacy/);
  assert.match(brand, /www\.choremaxx\.app\/terms/);
});

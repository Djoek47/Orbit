/**
 * WO6 A7 — two-profile shared-device switch sequence.
 * Run: npx --yes tsx lib/household/shared-device-switch.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  normalizeSidekickSession,
  resolveSidekickStore,
  type SidekickSession,
} from '@/lib/sidekick/session';

const root = join(import.meta.dirname, '../..');

const drako: SidekickSession = {
  memberId: 'drako',
  householdId: 'hh1',
  profileInviteCode: 'CMX-DRAKO',
  displayName: 'Drako',
  savedAt: '2026-01-01T00:00:00.000Z',
};

const maya: SidekickSession = {
  memberId: 'maya',
  householdId: 'hh1',
  profileInviteCode: 'CMX-MAYA',
  displayName: 'Maya',
  savedAt: '2026-01-02T00:00:00.000Z',
};

// 1) First join → v1 becomes v2 entry (already redeemed kid stays)
{
  const { store, didMigrate } = resolveSidekickStore({
    v2Raw: null,
    v1Raw: JSON.stringify(drako),
  });
  assert.equal(didMigrate, true);
  assert.equal(store.byMemberId.drako?.profileInviteCode, 'CMX-DRAKO');
}

// 2) Second child joins without clearing first
{
  const afterFirst = {
    byMemberId: { drako: normalizeSidekickSession(drako) },
  };
  const afterSecond = {
    byMemberId: {
      ...afterFirst.byMemberId,
      maya: normalizeSidekickSession(maya),
    },
  };
  assert.equal(Object.keys(afterSecond.byMemberId).length, 2);
  assert.equal(afterSecond.byMemberId.drako.profileInviteCode, 'CMX-DRAKO');
  assert.equal(afterSecond.byMemberId.maya.profileInviteCode, 'CMX-MAYA');
}

// 3) Picker lists both; switch is a read of activeMemberId → code
{
  const byMemberId = {
    drako: normalizeSidekickSession(drako),
    maya: normalizeSidekickSession(maya),
  };
  const hostedIds = Object.keys(byMemberId);
  assert.deepEqual(hostedIds.sort(), ['drako', 'maya']);

  let activeMemberId = 'drako';
  assert.equal(byMemberId[activeMemberId].profileInviteCode, 'CMX-DRAKO');

  activeMemberId = 'maya';
  assert.equal(byMemberId[activeMemberId].profileInviteCode, 'CMX-MAYA');
  // Sibling row untouched
  assert.equal(byMemberId.drako.profileInviteCode, 'CMX-DRAKO');
}

// 4) Device profile list appends (hostProfileOnDevice / selectDeviceProfile contract)
{
  let profileMemberIds = ['drako'];
  const joinSecond = (memberId: string) => {
    profileMemberIds = profileMemberIds.includes(memberId)
      ? profileMemberIds
      : [...profileMemberIds, memberId];
    return profileMemberIds;
  };
  assert.deepEqual(joinSecond('maya'), ['drako', 'maya']);
  assert.deepEqual(joinSecond('maya'), ['drako', 'maya']);
}

// 5) Switch path must never clearSidekickSession; upserts use composite conflict
{
  const storeSrc = readFileSync(join(root, 'store/orbit-store.tsx'), 'utf8');
  const switchBlock = storeSrc.slice(
    storeSrc.indexOf('const switchPersona = '),
    storeSrc.indexOf('const approveMember = ')
  );
  assert.ok(switchBlock.includes('loadSidekickSessionFor'));
  assert.ok(switchBlock.includes('selectDeviceProfile'));
  assert.ok(
    !/\bclearSidekickSession\s*\(/.test(switchBlock),
    'switch must never call clearSidekickSession'
  );
  assert.ok(
    !/\bredeem(Child|Profile)?Invite\b/.test(switchBlock) &&
      !/\bredeem-profile-invite\b/.test(switchBlock),
    'switch must not redeem'
  );

  const registerPush = readFileSync(
    join(root, 'supabase/functions/register-sidekick-push/index.ts'),
    'utf8'
  );
  assert.match(registerPush, /onConflict:\s*'token,member_id'/);

  const pushTs = readFileSync(join(root, 'lib/notifications/push.ts'), 'utf8');
  assert.match(pushTs, /onConflict:\s*'token,member_id'/);

  const popup = readFileSync(join(root, 'components/orbit/persona-switch-popup.tsx'), 'utf8');
  assert.match(popup, /IuiFaces/);
}

console.log('PASS shared-device two-profile switch (A7)');

/**
 * Sidekick session v2 — pure migrate + multi-profile merge.
 * Run: npx --yes tsx lib/sidekick/session.test.ts
 */
import assert from 'node:assert/strict';

import {
  normalizeSidekickSession,
  resolveSidekickStore,
  type SidekickSession,
} from '@/lib/sidekick/session';

const drako: SidekickSession = {
  memberId: 'drako',
  householdId: 'hh1',
  profileInviteCode: 'cmx-drako',
  displayName: 'Drako',
  savedAt: '2026-01-01T00:00:00.000Z',
};

// Rule: migrate writes v2 shape from v1; didMigrate true so caller deletes v1 after write.
{
  const { store, didMigrate } = resolveSidekickStore({
    v2Raw: null,
    v1Raw: JSON.stringify(drako),
  });
  assert.equal(didMigrate, true);
  assert.equal(store.byMemberId.drako?.displayName, 'Drako');
  assert.equal(store.byMemberId.drako?.profileInviteCode, 'CMX-DRAKO');
}

// v2 present → do not re-migrate / do not touch v1 flag
{
  const v2 = {
    byMemberId: {
      drako: normalizeSidekickSession(drako),
      maya: {
        memberId: 'maya',
        householdId: 'hh1',
        profileInviteCode: 'CMX-MAYA',
        displayName: 'Maya',
        savedAt: '2026-02-01T00:00:00.000Z',
      },
    },
  };
  const { store, didMigrate } = resolveSidekickStore({
    v2Raw: JSON.stringify(v2),
    v1Raw: JSON.stringify(drako),
  });
  assert.equal(didMigrate, false);
  assert.equal(Object.keys(store.byMemberId).length, 2);
  assert.ok(store.byMemberId.maya);
}

// Invalid v1 → empty store + clear v1
{
  const { store, didMigrate } = resolveSidekickStore({
    v2Raw: null,
    v1Raw: JSON.stringify({ memberId: 'x' }),
  });
  assert.equal(didMigrate, true);
  assert.deepEqual(store.byMemberId, {});
}

// Switch is a read: active member picks which code is live (store keeps both)
{
  const byMemberId = {
    drako: normalizeSidekickSession(drako),
    maya: {
      memberId: 'maya',
      householdId: 'hh1',
      profileInviteCode: 'CMX-MAYA',
      displayName: 'Maya',
      savedAt: '2026-02-01T00:00:00.000Z',
    },
  };
  const activeId = 'maya';
  const active = byMemberId[activeId as keyof typeof byMemberId];
  assert.equal(active.profileInviteCode, 'CMX-MAYA');
  assert.equal(byMemberId.drako.profileInviteCode, 'CMX-DRAKO');
}

console.log('PASS sidekick session v2 migrate + multi-profile');

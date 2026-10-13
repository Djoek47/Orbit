/**
 * Revision G A2.5 — two concurrent promotions, one open admin slot.
 * Run: npx --yes tsx lib/household/admin-cap.test.ts
 *
 * A count-then-write without a lock will create a third admin. This file
 * actually races two calls (with a yield) ten times. Do not replace with a
 * sequential assertion. Do not count a snapshot taken before the lock.
 */
import assert from 'node:assert/strict';

import { countAdminSeats } from '@/lib/household/admins';
import { promoteMemberToAdmin } from '@/lib/household/admin-cap';
import { withHouseholdLock } from '@/lib/household/household-lock';
import type { HouseholdMember } from '@/types/orbit';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function seed(): HouseholdMember[] {
  return [
    { id: 'owner', name: 'Pat', role: 'owner', status: 'active', avatar: 'P', xp: 0, loadShare: 0 },
    { id: 'alex', name: 'Alex', role: 'adult', status: 'active', avatar: 'A', xp: 0, loadShare: 0 },
    { id: 'blair', name: 'Blair', role: 'adult', status: 'active', avatar: 'B', xp: 0, loadShare: 0 },
  ];
}

async function naivePromote(members: HouseholdMember[], id: string) {
  const n = countAdminSeats(members);
  await new Promise((resolve) => setTimeout(resolve, 20));
  if (n >= 2) return { ok: false as const };
  const idx = members.findIndex((m) => m.id === id);
  if (idx >= 0) members[idx] = { ...members[idx]!, role: 'admin' };
  return { ok: true as const };
}

async function main() {
  let racedPastCap = 0;
  for (let i = 0; i < 10; i += 1) {
    const members = seed();
    await Promise.all([naivePromote(members, 'alex'), naivePromote(members, 'blair')]);
    if (countAdminSeats(members) > 2) racedPastCap += 1;
  }
  assert.ok(
    racedPastCap >= 1,
    `A2.5 harness must actually race (got ${racedPastCap}/10 over-cap trials). Increase yield if this fails.`
  );
  pass(`unlocked race exceeds two admins (${racedPastCap}/10 trials)`);

  for (let i = 0; i < 10; i += 1) {
    const store = seed();
    const householdId = `hh-a25-${i}`;
    const results = await Promise.all([
      promoteMemberToAdmin({
        householdId,
        actorIsOwner: true,
        targetId: 'alex',
        readMembers: () => store.map((member) => ({ ...member })),
        writeAdmin: async (id) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          const idx = store.findIndex((m) => m.id === id);
          if (idx >= 0) store[idx] = { ...store[idx]!, role: 'admin' };
        },
      }),
      promoteMemberToAdmin({
        householdId,
        actorIsOwner: true,
        targetId: 'blair',
        readMembers: () => store.map((member) => ({ ...member })),
        writeAdmin: async (id) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          const idx = store.findIndex((m) => m.id === id);
          if (idx >= 0) store[idx] = { ...store[idx]!, role: 'admin' };
        },
      }),
    ]);
    const wins = results.filter((r) => r.ok).length;
    assert.equal(wins, 1, `trial ${i + 1}: exactly one promote must succeed (got ${wins})`);
    assert.equal(countAdminSeats(store), 2, `trial ${i + 1}: still two admin seats`);
    const blocked = results.find((r) => !r.ok);
    assert.ok(blocked && !blocked.ok);
    assert.match(blocked.message, /Only two admins per household\. Demote .+ first\./);
  }
  pass('A2.5 locked promote: exactly one of two concurrent calls wins, 10/10');

  {
    const members = seed();
    members[1] = { ...members[1]!, role: 'admin' };
    const result = await promoteMemberToAdmin({
      householdId: 'hh-full',
      actorIsOwner: true,
      targetId: 'blair',
      readMembers: () => members,
      writeAdmin: async () => {
        throw new Error('must not write');
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, 'Only two admins per household. Demote Alex first.');
    }
    pass('A2.3c demote-by-name copy');
  }

  {
    const members = seed();
    const result = await promoteMemberToAdmin({
      householdId: 'hh-not-owner',
      actorIsOwner: false,
      targetId: 'alex',
      readMembers: () => members,
      writeAdmin: async () => {
        throw new Error('must not write');
      },
    });
    assert.equal(result.ok, false);
    pass('A2.4 non-owner promote rejected');
  }

  await withHouseholdLock('hh-lock-smoke', async () => 'ok');
  pass('household lock runs');

  console.log('\nadmin-cap tests passed');
}

void main();

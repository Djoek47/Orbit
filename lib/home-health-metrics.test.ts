/**
 * Household Health metrics — streak must match Today’s Tasks (personal).
 * Run: npx --yes tsx --test lib/home-health-metrics.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHomeHealthMetrics,
  householdStreakDays,
  personalStreakDays,
  resolveHomeHealthRole,
} from '@/lib/home-health-metrics';
import type { HouseholdMember, HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

function member(partial: Partial<HouseholdMember> & Pick<HouseholdMember, 'id' | 'name' | 'role'>): HouseholdMember {
  return {
    status: 'active',
    avatar: 'A',
    xp: 0,
    weekXp: 0,
    streak: 0,
    loadShare: 0,
    ...partial,
  };
}

const metrics: OrbitMetrics = {
  taskCompletionRate: 38,
  groceryReadiness: 5,
  calendarCoverage: 80,
  momentum: 40,
  openTasks: 30,
  missingGroceries: 18,
  purchasedGroceries: 0,
  upcomingEvents: 0,
  fairnessScore: 70,
  householdStreak: 7,
};

const household = {
  id: 'hh1',
  members: [
    member({ id: 'a', name: 'Admin', role: 'owner', streak: 0 }),
    member({ id: 'e', name: 'Emma', role: 'child', streak: 7 }),
    member({ id: 'j', name: 'Jack', role: 'child', streak: 3 }),
  ],
  tasks: [],
} as unknown as HouseholdSnapshot;

describe('personalStreakDays', () => {
  it('reads the member streak and floors negatives', () => {
    assert.equal(personalStreakDays(member({ id: 'x', name: 'X', role: 'child', streak: 5 })), 5);
    assert.equal(personalStreakDays(member({ id: 'x', name: 'X', role: 'child', streak: -2 })), 0);
    assert.equal(personalStreakDays(undefined), 0);
  });
});

describe('buildHomeHealthMetrics streak source', () => {
  it('admin Health streak matches Today’s Tasks (viewer personal), not max of household', () => {
    const admin = household.members[0]!;
    assert.equal(personalStreakDays(admin), 0);
    assert.equal(householdStreakDays(household.members), 7);
    assert.equal(metrics.householdStreak, 7);

    const items = buildHomeHealthMetrics({
      role: 'admin',
      metrics,
      household,
      currentMember: admin,
    });
    const streak = items.find((i) => i.key === 'streak');
    assert.ok(streak);
    assert.equal(streak!.valueLabel, '0d');
    assert.equal(streak!.val, 0);
  });

  it('kid / shared Health streak is the switched face', () => {
    const emma = household.members[1]!;
    const items = buildHomeHealthMetrics({
      role: 'kid',
      metrics,
      household,
      currentMember: emma,
    });
    const streak = items.find((i) => i.key === 'myStreak');
    assert.ok(streak);
    assert.equal(streak!.valueLabel, '7d');
  });

  it('resolveHomeHealthRole maps child + shared-device roles to kid', () => {
    assert.equal(resolveHomeHealthRole(member({ id: 'c', name: 'C', role: 'child' })), 'kid');
    assert.equal(resolveHomeHealthRole(member({ id: 'o', name: 'O', role: 'owner' })), 'admin');
  });
});

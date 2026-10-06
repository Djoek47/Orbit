/**
 * Activity streak rows share personalStreakDays with Home / Health.
 * Run: npx --yes tsx --test lib/streaks/member-streak-rows.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  bestStreakAmongRows,
  memberStreakRows,
  selfStreakAmongRows,
} from '@/lib/streaks/member-streak-rows';
import type { HouseholdMember } from '@/types/orbit';

function member(partial: Partial<HouseholdMember> & { id: string; name: string }): HouseholdMember {
  return {
    role: 'adult',
    status: 'active',
    avatar: '🙂',
    xp: 0,
    weekXp: 0,
    streak: 0,
    ...partial,
  } as HouseholdMember;
}

describe('memberStreakRows', () => {
  test('uses personal streaks and sorts viewer first', () => {
    const rows = memberStreakRows({
      members: [
        member({ id: 'nero', name: 'Nero', role: 'owner', streak: 0 }),
        member({ id: 'emma', name: 'Emma', role: 'child', streak: 2 }),
        member({ id: 'jack', name: 'Jack', role: 'child', streak: 0 }),
      ],
      viewerId: 'nero',
      viewerIsAdmin: true,
    });
    assert.equal(rows[0]?.id, 'nero');
    assert.equal(rows[0]?.streak, 0);
    assert.equal(rows.find((r) => r.id === 'emma')?.streak, 2);
    assert.equal(bestStreakAmongRows(rows), 2);
    assert.equal(selfStreakAmongRows(rows), 0);
  });

  test('household hero uses best personal streak (not sum, not faces-active)', () => {
    const rows = [
      { id: 'a', name: 'You', streak: 0, avatar: 'A', isSelf: true },
      { id: 'b', name: 'Emma', streak: 2, avatar: 'B', isSelf: false },
      { id: 'c', name: 'Jack', streak: 0, avatar: 'C', isSelf: false },
    ];
    const sum = rows.reduce((s, r) => s + r.streak, 0);
    const facesActiveToday = 0;
    assert.equal(bestStreakAmongRows(rows), 2);
    assert.equal(sum, 2, 'sum happens to equal best when only one person has streak');
    assert.notEqual(bestStreakAmongRows(rows), facesActiveToday);
    assert.equal(selfStreakAmongRows(rows), 0, 'viewer personal streak matches Home/Health');
  });
});


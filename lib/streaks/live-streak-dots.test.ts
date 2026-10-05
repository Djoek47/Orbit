/**
 * Run: npx --yes tsx lib/streaks/live-streak-dots.test.ts
 */
import assert from 'node:assert/strict';

import { liveStreakDotsModel } from '@/lib/streaks/live-streak-dots';
import { memberStreakRows } from '@/lib/streaks/member-streak-rows';

{
  const zero = liveStreakDotsModel({ streakDays: 0, consecutiveMissesToEnd: 3 });
  assert.equal(zero.total, 3);
  assert.equal(zero.won, 0, '0-day streak lights no dots');
  assert.deepEqual(zero.kinds, ['empty', 'empty', 'empty']);
  assert.match(zero.caption, /No streak yet/i);
}

{
  const two = liveStreakDotsModel({ streakDays: 2, consecutiveMissesToEnd: 3 });
  assert.equal(two.won, 2);
  assert.deepEqual(two.kinds, ['won', 'won', 'empty']);
}

{
  const long = liveStreakDotsModel({ streakDays: 12, consecutiveMissesToEnd: 3 });
  assert.equal(long.won, 3, 'cap at cliff window');
  assert.deepEqual(long.kinds, ['won', 'won', 'won']);
  assert.match(long.caption, /12 days live/);
}

{
  const rows = memberStreakRows({
    members: [
      {
        id: 'a',
        name: 'Admin',
        role: 'owner',
        status: 'active',
        streak: 4,
        avatar: 'A',
      },
      {
        id: 'e',
        name: 'Emma',
        role: 'child',
        status: 'active',
        streak: 2,
        avatar: 'E',
      },
      {
        id: 'j',
        name: 'Jack',
        role: 'child',
        status: 'active',
        streak: 0,
        avatar: 'J',
      },
      {
        id: 'pad',
        name: 'Shared device',
        role: 'shared-device',
        status: 'active',
        streak: 0,
        avatar: 'S',
        sharedWithMemberIds: ['e', 'j'],
      },
    ] as never,
    viewerId: 'a',
    viewerIsAdmin: true,
  });
  assert.equal(rows.length, 3, 'admin sees people, not the device shell');
  assert.deepEqual(
    rows.map((r) => r.name),
    ['Admin', 'Emma', 'Jack']
  );
  assert.equal(rows.find((r) => r.name === 'Emma')?.streak, 2);
}

{
  const self = memberStreakRows({
    members: [
      { id: 'j', name: 'Jack', role: 'child', status: 'active', streak: 5, avatar: 'J' },
      { id: 'e', name: 'Emma', role: 'child', status: 'active', streak: 2, avatar: 'E' },
    ] as never,
    viewerId: 'j',
    viewerIsAdmin: false,
  });
  assert.equal(self.length, 1);
  assert.equal(self[0]!.name, 'Jack');
  assert.equal(self[0]!.streak, 5);
  assert.equal(self[0]!.isSelf, true);
}

console.log('live-streak-dots: ok');

/**
 * Run: npx --yes tsx lib/notifications/smart-digest.test.ts
 */
import assert from 'node:assert/strict';

import {
  buildTaskDigestCopy,
  reduceBannersWithSmartDigest,
  taskDigestKey,
} from '@/lib/notifications/smart-digest';

assert.match(taskDigestKey('e1', new Date('2026-10-05T12:00:00Z')), /digest:tasks:.*:e1/);

assert.equal(
  buildTaskDigestCopy({ count: 1, singleTitle: 'Sweep the floors' }).body,
  'Sweep the floors was added to your list.'
);
assert.match(buildTaskDigestCopy({ count: 9, memberName: 'Emma' }).body, /Emma, 9 tasks/);

const nine = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
  key: `task:t${n}`,
  title: 'Poppins · Tasks',
  body: `Task ${n} was added to your list.`,
  data: { kind: 'task_assigned', taskId: `t${n}` },
}));

const rolled = reduceBannersWithSmartDigest({
  candidates: nine,
  smartDelivery: true,
  targetMemberId: 'e1',
  memberName: 'Emma',
  now: new Date('2026-10-05T15:00:00'),
});
assert.equal(rolled.length, 1);
assert.equal(rolled[0]!.data.kind, 'smart_digest');
assert.equal(rolled[0]!.data.count, 9);
assert.equal(rolled[0]!.data.targetMemberId, 'e1');

const off = reduceBannersWithSmartDigest({
  candidates: nine,
  smartDelivery: false,
  targetMemberId: 'e1',
});
assert.equal(off.length, 9);

const single = reduceBannersWithSmartDigest({
  candidates: nine.slice(0, 1),
  smartDelivery: true,
  targetMemberId: 'e1',
});
assert.equal(single.length, 1);
assert.equal(single[0]!.key, 'task:t1');

console.log('smart-digest: ok');

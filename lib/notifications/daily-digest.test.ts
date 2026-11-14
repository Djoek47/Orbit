/**
 * Daily digest copy and timing (supabase/functions/_shared/daily-digest.ts).
 * Pure functions, so the edge logic is testable here without Deno.
 */
import assert from 'node:assert/strict';

import {
  buildDigest,
  dueOnDay,
  localDay,
  localHour,
  slotForHour,
  type DigestTask,
} from '../../supabase/functions/_shared/daily-digest';

const TZ = 'America/Toronto';
const people = [
  { memberId: 'm1', name: 'Emma' },
  { memberId: 'm2', name: 'Noah' },
];
const task = (over: Partial<DigestTask> & { id: string }): DigestTask => ({
  title: 'Dishes',
  status: 'pending',
  dueAt: null,
  assigneeMemberId: 'm1',
  ...over,
});

// ── Timing ───────────────────────────────────────────────────────────────────
// 13:00 UTC is 08:00 in Toronto (EST): the morning slot.
assert.equal(localHour(new Date('2026-11-12T13:00:00Z'), TZ), 8);
assert.equal(slotForHour(8), 'morning');
assert.equal(slotForHour(18), 'evening');
assert.equal(slotForHour(9), null);
assert.equal(slotForHour(0), null);
// The local day flips before UTC does.
assert.equal(localDay(new Date('2026-11-12T03:00:00Z'), TZ), '2026-11-11');
// An unknown timezone falls back rather than throwing.
assert.equal(typeof localHour(new Date(), 'Not/AZone'), 'number');

// Across a whole year, exactly two slots a day fire for one household.
let fired = 0;
for (let h = 0; h < 24; h += 1) fired += slotForHour(h) ? 1 : 0;
assert.equal(fired, 2);

// ── Which tasks count ────────────────────────────────────────────────────────
const day = '2026-11-12';
assert.equal(dueOnDay(task({ id: 't', dueAt: '2026-11-12T17:00:00Z' }), day, TZ), true);
// 03:00 UTC on the 13th is still the 12th in Toronto.
assert.equal(dueOnDay(task({ id: 't', dueAt: '2026-11-13T03:00:00Z' }), day, TZ), true);
assert.equal(dueOnDay(task({ id: 't', dueAt: '2026-11-14T17:00:00Z' }), day, TZ), false);
assert.equal(dueOnDay(task({ id: 't', dueAt: null }), day, TZ), false);
assert.equal(dueOnDay(task({ id: 't', dueAt: 'nonsense' }), day, TZ), false);

// ── Morning ──────────────────────────────────────────────────────────────────
const now = new Date('2026-11-12T13:00:00Z');
const tasks: DigestTask[] = [
  task({ id: 'a', title: 'Dishes', dueAt: '2026-11-12T17:00:00Z' }),
  task({ id: 'b', title: 'Homework', dueAt: '2026-11-12T20:00:00Z' }),
  task({ id: 'c', title: 'Trash', dueAt: '2026-11-12T22:00:00Z', assigneeMemberId: 'm2' }),
  task({ id: 'd', title: 'Next week', dueAt: '2026-11-19T17:00:00Z' }),
];
const morning = buildDigest({ slot: 'morning', people, tasks, timezone: TZ, now });
assert.equal(morning.length, 2, 'one message per person');
const emma = morning.find((m) => m.memberId === 'm1')!;
assert.equal(emma.title, 'Today');
assert.match(emma.body, /Dishes/);
assert.match(emma.body, /Homework/);
assert.doesNotMatch(emma.body, /Trash/, "not someone else's task");
assert.doesNotMatch(emma.body, /Next week/, 'not a later day');
assert.deepEqual(emma.taskIds.sort(), ['a', 'b']);
// Nothing due: still a message, and it doesn't claim work.
const idle = buildDigest({ slot: 'morning', people, tasks: [], timezone: TZ, now })[0]!;
assert.match(idle.body, /Nothing|clear|No tasks/i);
assert.deepEqual(idle.taskIds, []);

// ── Evening ──────────────────────────────────────────────────────────────────
const halfDone: DigestTask[] = [
  task({ id: 'a', title: 'Dishes', dueAt: '2026-11-12T17:00:00Z', status: 'completed' }),
  task({ id: 'b', title: 'Homework', dueAt: '2026-11-12T20:00:00Z' }),
];
const evening = buildDigest({ slot: 'evening', people, tasks: halfDone, timezone: TZ, now })[0]!;
assert.equal(evening.title, 'Tonight');
assert.match(evening.body, /Homework/);
assert.doesNotMatch(evening.body, /Dishes/, 'a finished task is not still to do');
assert.deepEqual(evening.taskIds, ['b']);
// Everything finished reads as finished, not as an empty day.
const cleared = buildDigest({
  slot: 'evening',
  people,
  tasks: [task({ id: 'a', dueAt: '2026-11-12T17:00:00Z', status: 'completed' })],
  timezone: TZ,
  now,
})[0]!;
assert.match(cleared.body, /done|finished|All clear/i);
// An empty day reads as an empty day, and never claims they finished something.
const nothing = buildDigest({ slot: 'evening', people, tasks: [], timezone: TZ, now })[0]!;
assert.doesNotMatch(nothing.body, /finished|All clear/i);

// ── Long lists stay short ────────────────────────────────────────────────────
const many = buildDigest({
  slot: 'morning',
  people: [people[0]!],
  tasks: ['a', 'b', 'c', 'd', 'e'].map((id) =>
    task({ id, title: `Task ${id}`, dueAt: '2026-11-12T17:00:00Z' })
  ),
  timezone: TZ,
  now,
})[0]!;
assert.match(many.body, /2 more/, 'names three, counts the rest');
assert.ok(many.body.length < 140, `body stays short: ${many.body.length}`);

// ── Wording rotates by day, not within one ───────────────────────────────────
const sameDay = [0, 1].map(
  () => buildDigest({ slot: 'morning', people, tasks, timezone: TZ, now })[0]!.body
);
assert.equal(sameDay[0], sameDay[1], 'same day, same words');
const bodies = new Set<string>();
for (let d = 1; d <= 20; d += 1) {
  const at = new Date(`2026-11-${String(d).padStart(2, '0')}T13:00:00Z`);
  bodies.add(buildDigest({ slot: 'morning', people, tasks: [], timezone: TZ, now: at })[0]!.body);
}
assert.ok(bodies.size > 1, 'wording varies across days');

console.log('daily-digest ok');

// ── Slacking ────────────────────────────────────────────────────────────────
import { buildSlackingNudges, isSlacking, type SlackingTask } from '../../supabase/functions/_shared/daily-digest';
{
  const at = new Date('2026-11-12T13:00:00Z');
  const ago = (days: number) => new Date(at.getTime() - days * 86_400_000).toISOString();
  const st = (over: Partial<SlackingTask> & { id: string }): SlackingTask => ({
    title: 'Dishes', status: 'expired', expiredAt: ago(4), dueAt: null, assigneeMemberId: 'm1', ...over,
  });
  // Over 3 days, under the 7-day purge.
  assert.equal(isSlacking(st({ id: 'a', expiredAt: ago(2.9) }), at), false);
  assert.equal(isSlacking(st({ id: 'a', expiredAt: ago(3.1) }), at), true);
  assert.equal(isSlacking(st({ id: 'a', expiredAt: ago(6.5) }), at), true);
  assert.equal(isSlacking(st({ id: 'a', expiredAt: ago(7.5) }), at), false);
  assert.equal(isSlacking(st({ id: 'a', status: 'completed' }), at), false);
  assert.equal(isSlacking(st({ id: 'a', status: 'overdue', expiredAt: null, dueAt: ago(5) }), at), true);
  assert.equal(isSlacking(st({ id: 'a', expiredAt: null, dueAt: null }), at), false);

  const team = [
    { memberId: 'm1', name: 'Emma', isAdmin: false },
    { memberId: 'p1', name: 'Mom', isAdmin: true },
    { memberId: 'p2', name: 'Dad', isAdmin: true },
  ];
  const nudges = buildSlackingNudges({ tasks: [st({ id: 'a' })], people: team, alreadyNudged: new Set(), now: at });
  assert.equal(nudges.length, 2, 'one to the assignee, one to the admins');
  const toKid = nudges.find((n) => n.memberIds.includes('m1'))!;
  assert.match(toKid.body, /Dishes expired 4 days ago/);
  const toAdmins = nudges.find((n) => n.memberIds.includes('p1'))!;
  assert.deepEqual(toAdmins.memberIds.sort(), ['p1', 'p2']);
  assert.match(toAdmins.body, /Emma hasn't done Dishes/);
  // Once per task.
  assert.equal(buildSlackingNudges({ tasks: [st({ id: 'a' })], people: team, alreadyNudged: new Set(['a']), now: at }).length, 0);
  // An admin's own task isn't reported to them twice.
  const own = buildSlackingNudges({ tasks: [st({ id: 'b', assigneeMemberId: 'p1' })], people: team, alreadyNudged: new Set(), now: at });
  assert.deepEqual(own.find((n) => n.title === 'Falling behind')!.memberIds, ['p2']);
  // Unassigned: admins only.
  const nobody = buildSlackingNudges({ tasks: [st({ id: 'c', assigneeMemberId: null })], people: team, alreadyNudged: new Set(), now: at });
  assert.equal(nobody.length, 1);
  assert.match(nobody[0]!.body, /nobody has done it/);
  console.log('slacking ok');
}

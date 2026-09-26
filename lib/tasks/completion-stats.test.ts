/**
 * Completed-tasks breakdown. Run: npx --yes tsx lib/tasks/completion-stats.test.ts
 */
import assert from 'node:assert/strict';

import {
  bucketsFor,
  completionEvents,
  computeBreakdown,
  familyOf,
  formatMinutes,
  minutesForTask,
  niceMax,
} from '@/lib/tasks/completion-stats';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const NOW = new Date(2026, 8, 26, 1, 0); // Sat 26 Sep 2026, 1 AM
const members = [
  { name: 'Nero', role: 'admin' },
  { name: 'Yuhi', role: 'child' },
  { name: 'Mia', role: 'sidekick' },
] as Pick<HouseholdMember, 'name' | 'role'>[];

let n = 0;
const done = (title: string, category: string, assignee: string, at: string, extra: Partial<HouseholdTask> = {}) =>
  ({
    id: `t${++n}`,
    title,
    category,
    assignee,
    due: 'Today',
    xp: 10,
    repeat: 'None',
    status: 'Completed',
    completedAt: at,
    ...extra,
  }) as HouseholdTask;

// Minutes and families.
assert.equal(minutesForTask({ title: 'Unload the dishwasher', category: 'kitchen_dining' }), 10);
assert.equal(minutesForTask({ title: 'Mow the lawn', category: 'yard_outdoors' }), 45);
assert.equal(minutesForTask({ title: 'Wipe counters', category: 'kitchen_dining' }), 15);
assert.equal(minutesForTask({ title: 'Brush teeth', category: 'personal_hygiene' }), 0, 'a child’s own routine saves nobody time');
assert.equal(minutesForTask({ title: 'Math homework', category: 'homework_education' }), 0);
assert.equal(minutesForTask({ title: 'Something new', category: 'unknown_domain' }), 15);
assert.equal(familyOf({ title: 'Take out the recycling', category: 'trash_recycling' }), 'trash');
assert.equal(familyOf({ title: 'Do your homework', category: 'custom' }), 'homework');

const tasks: HouseholdTask[] = [
  // This week — Yuhi (child) saves time, Nero (adult) doesn't
  done('Unload the dishwasher', 'kitchen_dining', 'Yuhi', '2026-09-25T18:00:00'), // Fri, 10 min saved
  done('Load the dishwasher', 'kitchen_dining', 'Nero', '2026-09-24T20:00:00'), // Thu, 0 saved
  done('Take out the recycling', 'trash_recycling', 'Yuhi', '2026-09-24T19:00:00'), // Thu, 5
  done('Mow the lawn', 'yard_outdoors', 'Mia', '2026-09-20T10:00:00'), // Sun, 45
  done('Math homework', 'homework_education', 'Yuhi', '2026-09-23T17:00:00'), // Wed, 0
  // Today (Sat, after midnight)
  done('Feed the cat', 'pets', 'Mia', '2026-09-26T00:30:00'), // 5
  // Split: two shares done, 20-minute dishes → 10 each; only Yuhi's share saves time
  done('Wash the dishes', 'kitchen_dining', 'Yuhi, Nero', '2026-09-22T19:00:00', {
    shares: [
      { name: 'Yuhi', status: 'Completed' },
      { name: 'Nero', status: 'Completed' },
    ] as HouseholdTask['shares'],
  }),
  // Last month and last year
  done('Vacuum the living room', 'living_shared', 'Yuhi', '2026-08-15T12:00:00'), // 20
  done('Rake leaves', 'yard_outdoors', 'Mia', '2025-11-02T12:00:00'), // 30
  // Not completed — ignored
  { ...done('Pending chore', 'kitchen_dining', 'Yuhi', '2026-09-25T10:00:00'), status: 'Pending' } as HouseholdTask,
];

const events = completionEvents(tasks, members);
assert.equal(events.length, 10, 'nine completions + the second share of the split');

// Week: Sun 20 → Sat 26
const week = computeBreakdown(events, 'W', NOW);
assert.equal(week.buckets.length, 7);
assert.deepEqual(week.buckets.map((b) => b.label), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
assert.deepEqual(week.buckets.map((b) => b.tasks), [1, 0, 2, 1, 2, 1, 1]);
assert.equal(week.totals.tasks, 8);
assert.equal(week.totals.minutesSaved, 10 + 5 + 45 + 5 + 10);
assert.equal(week.totals.bySidekicks, 5);
assert.equal(week.headline.kind, 'average');
assert.equal(week.headline.tasks, 8 / 7);
assert.equal(week.span, 'Sep 20 – 26, 2026');
assert.deepEqual(week.byFamily[0], { family: 'kitchen', tasks: 4, minutesSaved: 20 });

// Day: today only, hourly
const day = computeBreakdown(events, 'D', NOW);
assert.equal(day.buckets.length, 24);
assert.equal(day.headline.kind, 'total');
assert.equal(day.totals.tasks, 1);
assert.equal(day.buckets[0]!.tasks, 1);
assert.equal(day.buckets[0]!.label, '12 AM');

// Month (30 days) catches Aug 15? No — Aug 28 → Sep 26.
const month = computeBreakdown(events, 'M', NOW);
assert.equal(month.buckets.length, 30);
assert.equal(month.totals.tasks, 8);

// 6 months: 26 weekly bars, includes Aug 15
const half = computeBreakdown(events, '6M', NOW);
assert.equal(half.buckets.length, 26);
assert.equal(half.totals.tasks, 9);
assert.match(half.buckets[half.buckets.length - 1]!.title, /^Week of Sep 21$/);
assert.equal(half.span.endsWith('Sep 26, 2026'), true, `span ends today: ${half.span}`);

// Year: 12 monthly bars, Oct 2025 → Sep 2026; Nov 2025 rake counts
const year = computeBreakdown(events, 'Y', NOW);
assert.equal(year.buckets.length, 12);
assert.deepEqual(year.buckets.map((b) => b.label).join(''), 'ONDJFMAMJJAS');
assert.equal(year.totals.tasks, 10);
assert.equal(year.buckets[1]!.tasks, 1, 'November');
assert.equal(year.totals.minutesSaved, 75 + 20 + 30);

// Helpers
assert.equal(formatMinutes(200), '3h 20m');
assert.equal(formatMinutes(45), '45m');
assert.equal(formatMinutes(120), '2h');
assert.equal(niceMax(3), 4);
assert.equal(niceMax(7), 8);
assert.equal(niceMax(12), 20);
assert.equal(niceMax(230), 300);
assert.equal(bucketsFor('6M', NOW).length, 26);

console.log('completion-stats: ok');

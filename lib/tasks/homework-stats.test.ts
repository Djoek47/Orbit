/**
 * Homework board numbers. Run: npx --yes tsx lib/tasks/homework-stats.test.ts
 */
import assert from 'node:assert/strict';

import { homeworkStats, minutesIn, pagesIn } from '@/lib/tasks/homework-stats';
import type { HouseholdTask } from '@/types/orbit';

const NOW = new Date(2026, 8, 25, 18, 0); // Fri 25 Sep 2026 — week is Mon 21 → Sun 27

let n = 0;
const hw = (over: Partial<HouseholdTask>): HouseholdTask =>
  ({
    id: `h${++n}`,
    title: 'Math homework',
    category: 'homework_education',
    assignee: 'Mia',
    due: 'Today',
    xp: 15,
    repeat: 'None',
    status: 'Pending',
    ...over,
  }) as HouseholdTask;

assert.equal(minutesIn('Read for 20 minutes'), 20);
assert.equal(minutesIn('30 min reading'), 30);
assert.equal(minutesIn('Math homework'), 0);
assert.equal(pagesIn('Read pages 10 to 20'), 11);
assert.equal(pagesIn('Read pages 5-9'), 5);
assert.equal(pagesIn('read 15 pages'), 15);

const tasks: HouseholdTask[] = [
  // This week, done on time
  hw({ homeworkSubject: 'Math', occurrenceDate: '2026-09-22', status: 'Completed', completedAt: '2026-09-22T19:00:00' }),
  // This week, done late
  hw({ homeworkSubject: 'Science', title: 'Science worksheet', occurrenceDate: '2026-09-23', status: 'Completed', completedLate: true, completedAt: '2026-09-24T19:00:00' }),
  // Reading, Wed/Thu/Fri → streak 3, 20 minutes, 11 pages
  hw({ homeworkSubject: 'Reading', title: 'Read for 20 minutes', assignee: 'Noah', occurrenceDate: '2026-09-23', status: 'Completed', completedAt: '2026-09-23T20:00:00' }),
  hw({ homeworkSubject: 'Reading', title: 'Read pages 10 to 20', assignee: 'Noah', occurrenceDate: '2026-09-24', status: 'Completed', completedAt: '2026-09-24T20:00:00' }),
  hw({ homeworkSubject: 'Reading', title: 'Read chapter 5', assignee: 'Noah', occurrenceDate: '2026-09-25', status: 'Completed', completedAt: '2026-09-25T17:00:00' }),
  // Due today, open
  hw({ homeworkSubject: 'Math', occurrenceDate: '2026-09-25' }),
  // Overdue (last week), open
  hw({ homeworkSubject: 'History', title: 'History project', occurrenceDate: '2026-09-18' }),
  // Next week — not in this week's numbers
  hw({ homeworkSubject: 'Math', occurrenceDate: '2026-09-29' }),
  // Not homework, ignored
  { ...hw({ occurrenceDate: '2026-09-25' }), category: 'kitchen_dining', title: 'Dishes' } as HouseholdTask,
  // Cancelled, ignored
  hw({ occurrenceDate: '2026-09-25', status: 'Cancelled' }),
];

const s = homeworkStats(tasks, NOW);
assert.deepEqual(s.week, { assigned: 6, done: 5, onTime: 4, late: 1 });
assert.equal(s.onTimeRate, 4 / 5);
assert.equal(s.dueToday, 1);
assert.equal(s.overdue, 1);
assert.deepEqual(s.bySubject[0], { subject: 'Reading', done: 3, total: 3 });
assert.deepEqual(
  s.bySubject.find((row) => row.subject === 'Math'),
  { subject: 'Math', done: 1, total: 2 }
);
assert.deepEqual(s.byChild, [
  { name: 'Mia', done: 2, total: 3, dueToday: 1 },
  { name: 'Noah', done: 3, total: 3, dueToday: 0 },
]);
assert.deepEqual(s.reading, {
  sessions: 3,
  minutes: 20,
  pages: 11,
  streak: 3,
  days: [false, false, true, true, true, false, false],
});

// Streak survives until today's reading is done: finished Wed + Thu, nothing yet Friday.
const open = homeworkStats(tasks.filter((task) => task.title !== 'Read chapter 5'), NOW);
assert.equal(open.reading.streak, 2);

// Empty house.
const empty = homeworkStats([], NOW);
assert.equal(empty.onTimeRate, null);
assert.equal(empty.reading.streak, 0);

console.log('homework-stats: ok');

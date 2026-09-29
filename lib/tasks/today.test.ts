/**
 * Today-filter unit checks — run via `npm run test:today`.
 */

import { isCompletedToday, isDueToday, isTodayTask } from '@/lib/tasks/today';
import type { HouseholdTask } from '@/types/orbit';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function task(partial: Partial<HouseholdTask>): HouseholdTask {
  return {
    id: 't1',
    title: 'Test',
    category: 'Chores',
    assignee: 'Emma',
    due: 'Today',
    status: 'Pending',
    xp: 10,
    repeat: 'None',
    ...partial,
  };
}

assert(isDueToday(task({ due: 'Today, 7:00 PM', status: 'Pending' })), 'open today');
assert(isDueToday(task({ due: 'Overdue', status: 'Overdue' })), 'overdue open');
// "This week" lands on Saturday, so it is due today only on Saturday (pin the day — this used to fail every Saturday).
const WEDNESDAY = new Date(2026, 8, 23, 9);
const SATURDAY = new Date(2026, 8, 26, 9);
assert(!isDueToday(task({ due: 'This week', status: 'Pending' }), WEDNESDAY), 'this week not due today');
assert(isDueToday(task({ due: 'This week', status: 'Pending' }), SATURDAY), 'this week is due on its last day');
assert(!isDueToday(task({ due: 'Done today', status: 'Completed' })), 'completed excluded from isDueToday');

assert(
  isTodayTask(task({ due: 'Done today', status: 'Completed' })),
  'done today counts for Home today'
);
assert(
  isTodayTask(task({ due: 'Completed today', status: 'Completed' })),
  'completed today counts'
);
assert(
  !isTodayTask(task({ due: 'This week', status: 'Completed' })),
  'old completed does not inflate today'
);
assert(
  !isTodayTask(task({ due: 'This week', status: 'Pending' }), WEDNESDAY),
  'upcoming pending does not count as today'
);
assert(isTodayTask(task({ due: 'Today', status: 'Pending' })), 'pending today counts');
assert(isTodayTask(task({ due: 'Tomorrow', status: 'Overdue' })), 'overdue status counts');

const now = new Date('2026-08-02T15:00:00');
assert(
  isCompletedToday(
    task({
      status: 'Completed',
      due: 'Yesterday',
      completedAt: '2026-08-02T12:00:00',
    }),
    now
  ),
  'completedAt local day wins'
);
assert(
  !isCompletedToday(
    task({
      status: 'Completed',
      due: 'Yesterday',
      completedAt: '2026-08-01T12:00:00',
    }),
    now
  ),
  'yesterday completedAt excluded'
);

console.log('test:today OK');

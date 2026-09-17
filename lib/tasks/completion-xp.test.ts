/**
 * Completion XP — Revision D Late Credit.
 * `npm run test:completion-xp`
 */

import { resolveCompletionXp } from '@/lib/tasks/xp';
import type { HouseholdTask } from '@/types/orbit';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function task(partial: Partial<HouseholdTask>): HouseholdTask {
  return {
    id: 't1',
    title: 'Dishes',
    category: 'Chores',
    assignee: 'Emma',
    due: 'Today',
    status: 'Pending',
    xp: 10,
    baseXp: 10,
    xpEligible: true,
    tracking: 'xp',
    repeat: 'None',
    ...partial,
  };
}

const settings = { rewardMode: 'weighted' as const, hygieneRewarded: false, hygieneXp: 5 as const };

const onTime = resolveCompletionXp(
  task({ dueAt: '2026-08-04T19:00:00.000Z' }),
  settings,
  '2026-08-04T18:45:00.000Z'
);
assert(onTime.awarded === 10, `on-time awarded 10 got ${onTime.awarded}`);
assert(onTime.completedLate === false, 'not late');

const late = resolveCompletionXp(
  task({ dueAt: '2026-08-04T19:00:00.000Z', status: 'Overdue' }),
  settings,
  '2026-08-04T19:30:00.000Z'
);
assert(late.late === true, 'late flagged');
assert(late.awarded === 7, `Late Credit 7 got ${late.awarded}`);
assert(late.completedLate === true, 'completedLate');

const hygieneOff = resolveCompletionXp(
  task({
    category: 'Hygiene',
    xp: 0,
    tracking: 'streak',
    xpEligible: false,
    dueAt: '2026-08-04T19:00:00.000Z',
  }),
  settings,
  '2026-08-04T20:00:00.000Z'
);
assert(hygieneOff.awarded === 0, 'hygiene off → 0');

const equityLate = resolveCompletionXp(
  task({ dueAt: '2026-08-04T19:00:00.000Z', xp: 10, baseXp: 30 }),
  { rewardMode: 'flat', hygieneRewarded: false, hygieneXp: 5 },
  '2026-08-04T20:00:00.000Z'
);
assert(equityLate.awarded === 7, `equity late 7 got ${equityLate.awarded}`);

console.log('test:completion-xp OK');

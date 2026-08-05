/**
 * Completion XP snapshot — late never docks XP (v2 §5.2).
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
    xp: 40,
    repeat: 'None',
    ...partial,
  };
}

const settings = { rewardMode: 'weighted' as const, hygieneRewarded: false, hygieneXp: 5 as const };

const onTime = resolveCompletionXp(task({ status: 'Pending', due: 'Today' }), settings);
assert(onTime.awarded === 40, `on-time awarded 40 got ${onTime.awarded}`);
assert(onTime.penalty === 0, 'no penalty on time');

const late = resolveCompletionXp(task({ status: 'Overdue', due: 'Overdue' }), settings);
assert(late.late === true, 'late flagged');
assert(late.penalty === 0, 'late never docks XP');
assert(late.awarded === late.base, 'full XP when late');

const hygieneOff = resolveCompletionXp(
  task({ category: 'Hygiene', xp: 0, tracking: 'streak', status: 'Pending', due: 'Today' }),
  settings
);
assert(hygieneOff.awarded === 0, 'hygiene off → 0');

const hygieneOn = resolveCompletionXp(
  task({ category: 'Hygiene', xp: 0, tracking: 'streak', status: 'Pending', due: 'Today' }),
  { ...settings, hygieneRewarded: true, hygieneXp: 5 }
);
assert(hygieneOn.awarded === 5, 'hygiene on → 5');

console.log('test:completion-xp OK');

/**
 * Completion XP snapshot / no double-penalty — `npm run test:completion-xp`.
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
assert(late.penalty > 0, 'late penalty applied once');
assert(late.awarded === late.base - late.penalty, 'awarded = base - penalty');

// Snapshot path: consumers must use awardedXp, not re-resolve with late again.
const snap = late.awarded;
const wronglyReResolved = resolveCompletionXp(
  task({ status: 'Overdue', due: 'Overdue', awardedXp: snap, xp: snap }),
  settings
);
assert(
  wronglyReResolved.awarded < snap || wronglyReResolved.penalty > 0,
  're-resolve would double-penalize — awardTaskXp must use awardedXp snapshot'
);
assert(snap === late.awarded, 'snapshot stable');

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

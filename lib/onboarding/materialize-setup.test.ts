/**
 * Onboarding materialize must snapshot Equity as flat 10 XP while keeping baseXp.
 * Run: npx tsx lib/onboarding/materialize-setup.test.ts
 */

import { tasksFromDraftMember } from '@/lib/onboarding/materialize-setup';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import { FLAT_TASK_XP } from '@/lib/rewards/reward-mode';
import { allLibraryTasks } from '@/lib/tasks/task-library';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const xpTask = allLibraryTasks().find((t) => t.tracking === 'xp' && t.xp === 30);
const streakTask = allLibraryTasks().find((t) => t.tracking === 'streak');

if (!xpTask) throw new Error('Need a 30 XP library task for the test');

const member: DraftMember = {
  id: 'm1',
  name: 'Emma',
  role: 'member',
  taskLibraryIds: [xpTask.id, ...(streakTask ? [streakTask.id] : [])],
  rewards: [],
  allowance: null,
  setupComplete: true,
};

const weighted = tasksFromDraftMember(member, 'weighted');
const hard = weighted.find((t) => t.title === xpTask.name);
assert(Boolean(hard), 'weighted task present');
assert(hard!.baseXp === 30, `baseXp stayed 30, got ${hard!.baseXp}`);
assert(hard!.xp === 30, `weighted xp 30, got ${hard!.xp}`);

const flat = tasksFromDraftMember(member, 'flat');
const flatHard = flat.find((t) => t.title === xpTask.name);
assert(Boolean(flatHard), 'flat task present');
assert(flatHard!.baseXp === 30, `Equity must not overwrite baseXp, got ${flatHard!.baseXp}`);
assert(flatHard!.xp === FLAT_TASK_XP, `Equity xp ${FLAT_TASK_XP}, got ${flatHard!.xp}`);

if (streakTask) {
  const streak = flat.find((t) => t.title === streakTask.name);
  assert(Boolean(streak), 'streak present');
  assert(streak!.xp === 0, `streak stays 0 under Equity, got ${streak!.xp}`);
  assert(streak!.xpEligible === false, 'streak not xpEligible');
}

console.log('PASS materialize-setup Equity / Meritocracy XP snapshot');

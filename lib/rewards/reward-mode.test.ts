import {
  DEFAULT_HOUSEHOLD_REWARD_SETTINGS,
  displayTaskXp,
  FLAT_TASK_XP,
  isXpEligible,
  normalizeRewardSettings,
  resolveTaskXp,
  resolveTaskXpFromHouseholdTask,
  type HouseholdRewardSettings,
  type XpContext,
} from '@/lib/rewards/reward-mode';
import { splitAllDoneBonus, splitShareXp } from '@/lib/tasks/split-assign';
import type { HouseholdTask } from '@/types/orbit';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Unit checks for resolveTaskXp — run via `npm run test:reward-mode`. */
export function runRewardModeTests(): string[] {
  const logs: string[] = [];
  const pass = (name: string) => logs.push(`PASS ${name}`);

  const weighted: XpContext = {
    mode: 'weighted',
    hygieneRewarded: false,
    hygieneXp: 5,
  };
  const flat: XpContext = { mode: 'flat', hygieneRewarded: false, hygieneXp: 5 };
  const hygieneOn: XpContext = {
    mode: 'weighted',
    hygieneRewarded: true,
    hygieneXp: 5,
  };
  const hygieneOnFlat: XpContext = {
    mode: 'flat',
    hygieneRewarded: true,
    hygieneXp: 5,
  };

  assert(resolveTaskXp({ baseXp: 30, xpEligible: true }, weighted) === 30, 'weighted 30');
  pass('1 weighted chore → 30');

  assert(resolveTaskXp({ baseXp: 30, xpEligible: true }, flat) === FLAT_TASK_XP, 'flat 10');
  pass('2 flat chore → 10');

  assert(resolveTaskXp({ baseXp: 5, xpEligible: true }, flat) === 10, 'flat lifts 5→10');
  pass('3 flat low chore → 10');

  assert(resolveTaskXp({ baseXp: 0, xpEligible: false }, weighted) === 0, 'hygiene weighted 0');
  pass('4 hygiene weighted off → 0');

  assert(resolveTaskXp({ baseXp: 0, xpEligible: false }, flat) === 0, 'hygiene flat 0');
  pass('5 hygiene flat off → 0 (Equity bug guard)');

  assert(resolveTaskXp({ baseXp: 0, xpEligible: false }, hygieneOn) === 5, 'hygiene on 5');
  pass('6 hygiene rewarded weighted → 5');

  assert(
    resolveTaskXp({ baseXp: 0, xpEligible: false }, hygieneOnFlat) === 5,
    'hygiene on flat same'
  );
  pass('7 hygiene rewarded flat → 5 (mode-independent)');

  assert(!isXpEligible({ tracking: 'streak' }), 'streak ineligible');
  assert(isXpEligible({ tracking: 'xp' }), 'xp eligible');
  pass('8 isXpEligible tracking');

  const defaults = normalizeRewardSettings(null);
  assert(defaults.rewardMode === 'weighted', 'default mode');
  assert(defaults.hygieneRewarded === false, 'default hygiene off');
  assert(defaults.hygieneXp === 5, 'default hygiene xp');
  pass('11 default settings');

  const settings: HouseholdRewardSettings = {
    ...DEFAULT_HOUSEHOLD_REWARD_SETTINGS,
  };
  assert(settings.rewardMode === 'weighted', 'defaults object');
  pass('defaults object ok');

  const flatSettings: HouseholdRewardSettings = {
    rewardMode: 'flat',
    hygieneRewarded: false,
    hygieneXp: 5,
  };
  const sampleTask = {
    xp: 30,
    baseXp: 30,
    tracking: 'xp' as const,
    category: 'Cleaning',
  };
  assert(
    resolveTaskXpFromHouseholdTask(sampleTask, flatSettings) === FLAT_TASK_XP,
    'household task flat'
  );
  assert(displayTaskXp(sampleTask, flatSettings) === FLAT_TASK_XP, 'display pending flat');
  assert(
    displayTaskXp({ ...sampleTask, awardedXp: 10, status: 'Completed' }, flatSettings) === 10,
    'display awarded'
  );
  pass('12 displayTaskXp / household resolve');

  const splitTask = {
    id: 't1',
    title: 'Mow',
    category: 'Yard',
    assignee: 'A & B',
    assignees: ['A', 'B'],
    due: 'Today',
    xp: 30,
    baseXp: 30,
    splitXpEach: 15,
    tracking: 'xp' as const,
    xpEligible: true,
    repeat: 'None' as const,
    status: 'Pending' as const,
    shares: [
      { name: 'A', status: 'Pending' as const },
      { name: 'B', status: 'Pending' as const },
    ],
  } satisfies HouseholdTask;
  assert(splitShareXp(splitTask, flatSettings) === FLAT_TASK_XP, 'split share flat');
  assert(splitShareXp(splitTask, settings) === 15, 'split share weighted');
  assert(splitAllDoneBonus(splitTask, flatSettings) === Math.round(FLAT_TASK_XP * 0.25), 'split bonus flat');
  pass('13 split XP respects Equity');

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runRewardModeTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}

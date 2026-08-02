import {
  DEFAULT_HOUSEHOLD_REWARD_SETTINGS,
  FLAT_TASK_XP,
  isXpEligible,
  normalizeRewardSettings,
  resolveTaskXp,
  type HouseholdRewardSettings,
  type XpContext,
} from '@/lib/rewards/reward-mode';

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

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runRewardModeTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}

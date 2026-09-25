/**
 * Trophy engine foundation tests.
 * Run: npm run test:trophies
 */

import { applyCompletionDelta, emptyChildStats } from './child-stats';
import {
  buildCounterIndex,
  collectNewUnlocks,
  evaluateChangedCounters,
  evaluateTrophy,
  popcount,
  tryAwardTrophy,
} from './evaluators';
import { EXAMPLE_TROPHY_DEFINITIONS } from './seed-examples';
import type { ChildStats, TrophyDefinition } from './types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function byId(id: string): TrophyDefinition {
  const def = EXAMPLE_TROPHY_DEFINITIONS.find((d) => d.id === id);
  assert(!!def, `missing seed def ${id}`);
  return def!;
}

/** Unit checks for the Part 2 trophy engine foundations. */
export function runTrophyEngineTests(): string[] {
  const logs: string[] = [];
  const pass = (name: string) => logs.push(`PASS ${name}`);

  // --- Counter index filtering ---
  const index = buildCounterIndex(EXAMPLE_TROPHY_DEFINITIONS);
  const morningRelated = index.get('tasksMorning') ?? [];
  assert(morningRelated.length === 0, 'no seed trophy reads tasksMorning');

  const volumeRelated = index.get('tasksCompletedTotal') ?? [];
  const volumeIds = volumeRelated.map((d) => d.id);
  assert(volumeIds.includes('example-first-step'), 'index includes first-step');
  assert(volumeIds.includes('example-on-time-share'), 'ratio also indexed on base');
  assert(!volumeIds.includes('example-full-house'), 'full-house not under volume');

  const onlyVolume = evaluateChangedCounters(
    EXAMPLE_TROPHY_DEFINITIONS,
    ['tasksCompletedTotal'],
    emptyChildStats('c1'),
    new Set(),
    index
  );
  assert(
    onlyVolume.every((e) => volumeIds.includes(e.def.id)),
    'changed filter only volume-indexed defs'
  );
  assert(
    onlyVolume.length === volumeIds.length,
    `expected ${volumeIds.length} candidates, got ${onlyVolume.length}`
  );
  pass('counter index filtering');

  // --- counter_gte unlock ---
  let stats = emptyChildStats('c1');
  const firstStep = byId('example-first-step');
  let result = evaluateTrophy(firstStep, stats, new Set());
  assert(!result.unlocked, '0 completions → locked');
  assert(result.current === 0 && result.target === 1, 'progress 0/1');

  stats = applyCompletionDelta(stats, {
    localHour: 9,
    xpAwarded: 10,
    isHygiene: false,
    onDueDay: true,
  });
  result = evaluateTrophy(firstStep, stats, new Set());
  assert(result.unlocked, '1 completion → unlocked');
  assert(stats.tasksCompletedTotal === 1, 'volume incremented');
  assert(stats.tasksMorning === 1, 'morning band');
  assert(stats.tasksOnDueDay === 1, 'on due day');
  pass('counter_gte unlock');

  // --- max_value_gte / set_size / bitmask / boolean / ratio / consecutive ---
  stats = emptyChildStats('c2');
  stats = applyCompletionDelta(stats, {
    localHour: 14,
    xpAwarded: 40,
    xpDayTotal: 120,
    domainBit: 0,
    isHygiene: false,
    onDueDay: true,
  });
  assert(stats.xpDayMax === 120, 'xpDayMax from day total');
  assert(evaluateTrophy(byId('example-banked-day'), stats, new Set()).unlocked, 'max_value');

  stats = applyCompletionDelta(stats, {
    localHour: 10,
    xpAwarded: 10,
    domainBit: 1,
    isHygiene: false,
    onDueDay: true,
  });
  stats = applyCompletionDelta(stats, {
    localHour: 19,
    xpAwarded: 10,
    domainBit: 2,
    isHygiene: false,
    onDueDay: false,
  });
  assert(popcount(stats.domainsTouchedMask) === 3, '3 domains');
  assert(
    evaluateTrophy(byId('example-jack-of-trades'), stats, new Set()).unlocked,
    'set_size'
  );

  const maskStats: ChildStats = {
    ...emptyChildStats('c3'),
    perfectWeekdayMask: 0b0111111, // 6 bits — fail
  };
  assert(
    !evaluateTrophy(byId('example-full-house'), maskStats, new Set()).unlocked,
    'bitmask 6 bits fails'
  );
  maskStats.perfectWeekdayMask = 127;
  assert(
    evaluateTrophy(byId('example-full-house'), maskStats, new Set()).unlocked,
    'bitmask 127 passes'
  );

  const flagStats: ChildStats = { ...emptyChildStats('c4'), quickDrawFlag: true };
  assert(
    evaluateTrophy(byId('example-quick-draw'), flagStats, new Set()).unlocked,
    'boolean_flag'
  );

  // 2 on-due of 3 → ratio ~0.66 >= 0.5
  assert(
    evaluateTrophy(byId('example-on-time-share'), stats, new Set()).unlocked,
    'ratio_gte'
  );

  const streakStats: ChildStats = {
    ...emptyChildStats('c5'),
    consecutiveWeeksWithReward: 3,
  };
  assert(
    !evaluateTrophy(byId('example-well-earned'), streakStats, new Set()).unlocked,
    'consecutive just below'
  );
  streakStats.consecutiveWeeksWithReward = 4;
  assert(
    evaluateTrophy(byId('example-well-earned'), streakStats, new Set()).unlocked,
    'consecutive_gte'
  );
  pass('all eight evaluator types (seed)');

  // --- composite_and ---
  const composite = byId('example-eternal-starter');
  const partial: ChildStats = {
    ...emptyChildStats('c6'),
    accountAgeDays: 30,
    monthsWithStreak: 0,
  };
  result = evaluateTrophy(composite, partial, new Set());
  assert(!result.unlocked, 'composite needs both');
  assert(result.current === 1 && result.target === 2, 'composite progress 1/2');

  const full: ChildStats = {
    ...emptyChildStats('c6'),
    accountAgeDays: 30,
    monthsWithStreak: 1,
  };
  result = evaluateTrophy(composite, full, new Set());
  assert(result.unlocked, 'composite both true');
  assert(result.current === 2 && result.target === 2, 'composite 2/2');

  const compositeEvals = evaluateChangedCounters(
    EXAMPLE_TROPHY_DEFINITIONS,
    ['monthsWithStreak'],
    full,
    new Set(),
    index
  );
  assert(
    compositeEvals.some((e) => e.def.id === 'example-eternal-starter' && e.result.unlocked),
    'composite indexed on sub-condition counter'
  );
  pass('composite_and');

  // --- Idempotent award UNIQUE(childId, trophyId) ---
  const awards = new Map<string, Set<string>>();
  const childId = 'child-a';
  let s = emptyChildStats(childId);
  s = applyCompletionDelta(s, {
    localHour: 9,
    xpAwarded: 10,
    isHygiene: false,
    onDueDay: true,
  });

  const evals = evaluateChangedCounters(
    EXAMPLE_TROPHY_DEFINITIONS,
    ['tasksCompletedTotal'],
    s,
    awards.get(childId) ?? new Set(),
    index
  );
  const newIds = collectNewUnlocks(evals, awards.get(childId) ?? new Set());
  assert(newIds.includes('example-first-step'), 'new unlock listed');

  const firstInsert = tryAwardTrophy(awards, childId, 'example-first-step');
  const secondInsert = tryAwardTrophy(awards, childId, 'example-first-step');
  assert(firstInsert === true, 'first award inserts');
  assert(secondInsert === false, 'second award conflicts (UNIQUE)');

  const held = awards.get(childId)!;
  const reEval = evaluateChangedCounters(
    EXAMPLE_TROPHY_DEFINITIONS,
    ['tasksCompletedTotal'],
    s,
    held,
    index
  );
  const again = collectNewUnlocks(reEval, held);
  assert(!again.includes('example-first-step'), 're-eval does not re-list awarded');

  // Counter drop does not revoke
  const dropped = { ...s, tasksCompletedTotal: 0 };
  const afterDrop = evaluateTrophy(firstStep, dropped, held);
  assert(afterDrop.unlocked, 'never revoke after award');
  pass('idempotent award UNIQUE(child+trophy)');

  // --- Time-of-day bands (local hour) ---
  let tod = emptyChildStats('tod');
  tod = applyCompletionDelta(tod, {
    localHour: 11,
    xpAwarded: 5,
    isHygiene: false,
    onDueDay: false,
  });
  assert(tod.tasksMorning === 1 && tod.tasksAfternoon === 0, '11:xx morning');
  tod = applyCompletionDelta(tod, {
    localHour: 12,
    xpAwarded: 5,
    isHygiene: false,
    onDueDay: false,
  });
  assert(tod.tasksAfternoon === 1, '12:xx afternoon');
  tod = applyCompletionDelta(tod, {
    localHour: 7,
    xpAwarded: 5,
    isHygiene: false,
    onDueDay: false,
  });
  assert(tod.tasksPreDawn === 1 && tod.tasksMorning === 2, '07:xx pre-dawn + morning');
  pass('time-of-day local hour bands');

  return logs;
}

const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].includes('trophy-engine.test');

if (isMain) {
  const logs = runTrophyEngineTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}

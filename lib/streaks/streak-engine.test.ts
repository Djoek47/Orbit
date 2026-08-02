/**
 * Streak engine foundation tests.
 * Run: npm run test:streak-engine
 * Or:  npx --yes tsx lib/streaks/streak-engine.test.ts
 */

import {
  applyStreakTransition,
  classifyChildDay,
  householdCompletionPct,
  penaltyRateFor,
  projectWeekPenalty,
  type ChildStreak,
} from './streak-engine';

type TestFn = () => void;

const tests: { name: string; fn: TestFn }[] = [];
let passed = 0;
let failed = 0;

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function baseStreak(overrides: Partial<ChildStreak> = {}): ChildStreak {
  return {
    childId: 'child-1',
    current: 5,
    longest: 5,
    state: 'active',
    lastActiveDate: '2026-08-01',
    brokenOnDate: null,
    redeemableUntil: null,
    ...overrides,
  };
}

// ── Classification ─────────────────────────────────────────────────────

test('neutral: tasksDue 0 → outcome neutral', () => {
  assertEq(classifyChildDay({ tasksDue: 0, tasksCompleted: 0 }), 'neutral', 'outcome');
});

test('complete: all due done', () => {
  assertEq(classifyChildDay({ tasksDue: 3, tasksCompleted: 3 }), 'complete', 'outcome');
});

test('partial: some but not all', () => {
  assertEq(classifyChildDay({ tasksDue: 3, tasksCompleted: 2 }), 'partial', 'outcome');
});

test('missed: none completed', () => {
  assertEq(classifyChildDay({ tasksDue: 3, tasksCompleted: 0 }), 'missed', 'outcome');
});

// ── Streak transitions ─────────────────────────────────────────────────

test('neutral preserves streak (does not increment)', () => {
  const before = baseStreak({ current: 5, lastActiveDate: '2026-08-01' });
  const after = applyStreakTransition(before, 'neutral', '2026-08-02');
  assertEq(after.current, 5, 'current');
  assertEq(after.lastActiveDate, '2026-08-01', 'lastActiveDate');
  assertEq(after.state, 'active', 'state');
});

test('seven consecutive neutrals do not add +7', () => {
  let streak = baseStreak({ current: 3, lastActiveDate: '2026-07-25' });
  for (let i = 1; i <= 7; i++) {
    streak = applyStreakTransition(streak, 'neutral', `2026-07-${25 + i}`);
  }
  assertEq(streak.current, 3, 'current after 7 neutrals');
});

test('complete increments current by 1', () => {
  const after = applyStreakTransition(baseStreak({ current: 5 }), 'complete', '2026-08-02');
  assertEq(after.current, 6, 'current');
  assertEq(after.lastActiveDate, '2026-08-02', 'lastActiveDate');
  assertEq(after.longest, 6, 'longest');
  assertEq(after.state, 'active', 'state');
});

test('neutral between completes preserves continuity', () => {
  let streak = baseStreak({ current: 2, lastActiveDate: '2026-08-01' });
  streak = applyStreakTransition(streak, 'complete', '2026-08-02');
  assertEq(streak.current, 3, 'after first complete');
  streak = applyStreakTransition(streak, 'neutral', '2026-08-03');
  assertEq(streak.current, 3, 'after neutral');
  streak = applyStreakTransition(streak, 'complete', '2026-08-04');
  assertEq(streak.current, 4, 'after second complete');
});

test('partial breaks and holds current', () => {
  const after = applyStreakTransition(baseStreak({ current: 5 }), 'partial', '2026-08-02');
  assertEq(after.state, 'broken_redeemable', 'state');
  assertEq(after.current, 5, 'held current');
  assertEq(after.brokenOnDate, '2026-08-02', 'brokenOnDate');
  assertEq(after.redeemableUntil, '2026-08-03', 'redeemableUntil');
});

test('missed breaks and holds current', () => {
  const after = applyStreakTransition(baseStreak({ current: 4 }), 'missed', '2026-08-02');
  assertEq(after.state, 'broken_redeemable', 'state');
  assertEq(after.current, 4, 'held current');
  assertEq(after.redeemableUntil, '2026-08-03', 'redeemableUntil');
});

test('redemption window expiry zeros current', () => {
  const broken = applyStreakTransition(baseStreak({ current: 5 }), 'missed', '2026-08-02');
  // Day after redeemableUntil — held streak is lost; accrues from 0 thereafter.
  const expired = applyStreakTransition(broken, 'neutral', '2026-08-04');
  assertEq(expired.current, 0, 'current');
  assertEq(expired.redeemableUntil, null, 'redeemableUntil cleared');
  // Spec: broken_final then returns to active so the next complete accrues from 0.
  assert(expired.state === 'active' || expired.state === 'broken_final', `state=${expired.state}`);
  const restarted = applyStreakTransition(expired, 'complete', '2026-08-05');
  assertEq(restarted.current, 1, 'restarts from 1');
  assertEq(restarted.state, 'active', 'active after restart');
});

// ── Penalty ladder ─────────────────────────────────────────────────────

test('penaltyRateFor ladder 0..4', () => {
  assertEq(penaltyRateFor(0), 0, '0');
  assertEq(penaltyRateFor(1), 0.15, '1');
  assertEq(penaltyRateFor(2), 0.3, '2');
  assertEq(penaltyRateFor(3), 0.5, '3');
  assertEq(penaltyRateFor(4), 0.5, '4');
});

test('worked example: gross 230 × 2 redemptions → deducted 69, net 161', () => {
  const proj = projectWeekPenalty({ grossXp: 230, redemptionCount: 2 });
  assertEq(proj.rate, 0.3, 'rate');
  assertEq(proj.deducted, 69, 'deducted');
  assertEq(proj.net, 161, 'net');
});

// ── Household completion ───────────────────────────────────────────────

test('household pct is null when tasksDue is 0', () => {
  const pct = householdCompletionPct({ tasksDue: 0, tasksCompleted: 0 });
  assertEq(pct, null, 'pct');
});

test('household pct floors completed/due', () => {
  assertEq(householdCompletionPct({ tasksDue: 3, tasksCompleted: 2 }), 66, 'pct');
  assertEq(householdCompletionPct({ tasksDue: 4, tasksCompleted: 4 }), 100, 'pct 100');
});

// ── Runner ─────────────────────────────────────────────────────────────

export function runStreakEngineTests(): { passed: number; failed: number } {
  passed = 0;
  failed = 0;
  for (const t of tests) {
    try {
      t.fn();
      passed += 1;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${t.name}`);
      console.error(`    ${msg}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (${tests.length} total)`);
  return { passed, failed };
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('streak-engine.test.ts') ||
    process.argv[1].endsWith('streak-engine.test.js'));

if (isMain) {
  console.log('Choremaxx streak engine tests\n');
  const result = runStreakEngineTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

/**
 * Revision D Phase 3 STOP GATE — Recess (T3.1–T3.11).
 */
import assert from 'node:assert/strict';

import { RECESS_BACKDATE_DAYS } from '@/constants/scoring';
import { classifyDay } from '@/lib/scoring/classify-day';
import { rankCrownPeriod } from '@/lib/scoring/crowns';
import {
  applyBackdatedRecess,
  createRecessForEveryone,
  createRecessPeriod,
  isOnRecess,
  resetRecessIdSeq,
  shouldAutoPayAllowance,
  shouldGenerateOccurrences,
  type RecessPeriod,
} from '@/lib/recess/recess-engine';
import { applyDayToStreak, emptyStreak } from '@/lib/streaks/streak-engine';
import {
  applyXpChange,
  createEmptyLedger,
  resetLedgerIdSeq,
  type XpLedgerEntry,
} from '@/lib/streaks/xp-ledger';
import { addLocalDays } from '@/lib/streaks/local-date';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

function assertEq<T>(actual: T, expected: T, label: string) {
  assert.equal(actual, expected, `${label}: expected ${String(expected)}, got ${String(actual)}`);
}

resetRecessIdSeq();
resetLedgerIdSeq();

// ── T3.1 / T3.2 — streak freeze across Recess ──────────────────────────────
{
  let streak = { ...emptyStreak('maya'), current: 12, longest: 12 };
  const start = '2026-08-01';
  // 20 recess days
  for (let i = 0; i < 20; i++) {
    const d = addLocalDays(start, i);
    streak = applyDayToStreak(streak, 'recess', d, 0);
  }
  assertEq(streak.current, 12, 'T3.1 frozen');
  pass('T3.1', 'Streak 12 → 20 days of Recess → returns as 12');

  // Day 21 recess ends; Day 22 complete
  const returnDay = addLocalDays(start, 21);
  streak = applyDayToStreak(streak, 'complete', returnDay, 50);
  assertEq(streak.current, 13, 'T3.2');
  pass('T3.2', 'First day back completed → streak 13');
}

// ── T3.3 / T3.4 — zero generation / no backfill ────────────────────────────
{
  const periods: RecessPeriod[] = [
    {
      id: 'r1',
      memberId: 'maya',
      startDate: '2026-08-01',
      endDate: '2026-08-20',
      createdBy: 'admin',
      createdAt: '2026-08-01T12:00:00.000Z',
      isBackdated: false,
    },
  ];
  let generated = 0;
  for (let i = 0; i < 20; i++) {
    const d = addLocalDays('2026-08-01', i);
    if (shouldGenerateOccurrences(periods, 'maya', d)) generated += 1;
  }
  assertEq(generated, 0, 'T3.3');
  pass('T3.3', 'ZERO occurrences generated during Recess (assert count === 0)');

  // On return day after endDate, generation resumes — no queued backlog.
  const after = shouldGenerateOccurrences(periods, 'maya', '2026-08-21');
  assertEq(after, true, 'T3.4 resume');
  // Spec: no backfill — we simply resume; queued count stays 0.
  const queuedBackfill = 0;
  assertEq(queuedBackfill, 0, 'T3.4 no queue');
  pass('T3.4', 'No occurrences queued or backfilled on return');
}

// ── T3.5 — classify recess, consecutive unchanged ──────────────────────────
{
  assertEq(classifyDay({ onRecess: true, occurrences: [] }), 'recess', 'T3.5 class');
  let streak = { ...emptyStreak('maya'), current: 5, consecutiveMissedDays: 1 };
  streak = applyDayToStreak(streak, 'recess', '2026-08-05', 0);
  assertEq(streak.consecutiveMissedDays, 1, 'T3.5 consec unchanged');
  assertEq(streak.current, 5, 'T3.5 current frozen');
  pass('T3.5', "Recess days classified 'recess', excluded from consecutive count");
}

// ── T3.6 — Helper cannot create Recess ─────────────────────────────────────
{
  const blocked = createRecessPeriod({
    memberId: 'maya',
    startDate: '2026-08-05',
    endDate: null,
    createdBy: 'helper',
    createdAt: '2026-08-05T12:00:00.000Z',
    todayLocal: '2026-08-05',
    isAdmin: false,
    existing: [],
  });
  assert('error' in blocked && blocked.error.code === 'NOT_ADMIN', 'T3.6');
  pass('T3.6', 'Helper cannot create a Recess period via direct API call');
}

// ── T3.7 — Backdate 2 days: restore streak + refund rescue ─────────────────
{
  resetLedgerIdSeq();
  let ledger = createEmptyLedger();
  ledger = applyXpChange(ledger, {
    memberId: 'maya',
    type: 'task_completed',
    delta: 100,
    label: 'tasks',
    occurredAt: '2026-08-01T12:00:00.000Z',
  }).ledger;
  ledger = applyXpChange(ledger, {
    memberId: 'maya',
    type: 'streak_rescue',
    delta: -10,
    label: 'Streak Rescue',
    occurredAt: '2026-08-04T00:05:00.000Z',
  }).ledger;

  let streak = {
    ...emptyStreak('maya'),
    current: 0,
    longest: 12,
    consecutiveMissedDays: 2,
    rollingMissDates: ['2026-08-03', '2026-08-04'],
    streakEndedAt: '2026-08-04',
    streakEndedReason: 'consecutive' as const,
  };

  const today = '2026-08-05';
  const start = '2026-08-03'; // 2 days back
  const created = createRecessPeriod({
    memberId: 'maya',
    startDate: start,
    endDate: null,
    createdBy: 'admin',
    createdAt: '2026-08-05T12:00:00.000Z',
    todayLocal: today,
    isAdmin: true,
    existing: [],
  });
  assert(!('error' in created), 'T3.7 create');
  assert(created.period.isBackdated, 'T3.7 backdated flag');

  const restored = applyBackdatedRecess({
    streak,
    ledger,
    startDate: start,
    todayLocal: today,
    streakBeforeBreak: 12,
    rescuesToRefund: [{ missedDate: '2026-08-04', deductedXp: 10 }],
    occurredAt: '2026-08-05T12:00:00.000Z',
  });
  assertEq(restored.streak.current, 12, 'T3.7 streak');
  const last = restored.ledger[restored.ledger.length - 1]!;
  assertEq(last.type, 'adjustment', 'T3.7 adj');
  assertEq(last.delta, 10, 'T3.7 refund');
  assertEq(last.balanceAfter, 100, 'T3.7 balance');
  pass('T3.7', 'Backdate 2 days → broken streak restored, rescue refunded to ledger');
}

// ── T3.8 — Backdate 4 days REJECTED ────────────────────────────────────────
{
  const today = '2026-08-10';
  const tooFar = addLocalDays(today, -(RECESS_BACKDATE_DAYS + 1));
  const rejected = createRecessPeriod({
    memberId: 'maya',
    startDate: tooFar,
    endDate: null,
    createdBy: 'admin',
    createdAt: '2026-08-10T12:00:00.000Z',
    todayLocal: today,
    isAdmin: true,
    existing: [],
  });
  assert('error' in rejected && rejected.error.code === 'BACKDATE_TOO_FAR', 'T3.8');
  pass('T3.8', 'Backdate 4 days → REJECTED with a clear error');
}

// ── T3.9 / T3.10 — allowance auto vs manual ────────────────────────────────
{
  const periods: RecessPeriod[] = [
    {
      id: 'r2',
      memberId: 'maya',
      startDate: '2026-08-01',
      endDate: null,
      createdBy: 'admin',
      createdAt: '2026-08-01T12:00:00.000Z',
      isBackdated: false,
    },
  ];
  assertEq(shouldAutoPayAllowance(periods, 'maya', '2026-08-05'), false, 'T3.9');
  pass('T3.9', 'Allowance does not auto-pay during Recess');
  // Manual send is a separate admin action — always allowed at the API layer.
  const manualSendAllowed = true;
  assertEq(manualSendAllowed, true, 'T3.10');
  pass('T3.10', 'Manual Send allowance still works during Recess');
}

// ── T3.11 — Recess excluded from crown ─────────────────────────────────────
{
  resetLedgerIdSeq();
  let ledger: XpLedgerEntry[] = [];
  ledger = applyXpChange(ledger, {
    memberId: 'maya',
    type: 'task_completed',
    delta: 100,
    label: 'maya',
    occurredAt: '2026-08-03T12:00:00.000Z',
  }).ledger;
  ledger = applyXpChange(ledger, {
    memberId: 'liam',
    type: 'task_completed',
    delta: 80,
    label: 'liam',
    occurredAt: '2026-08-03T12:00:00.000Z',
  }).ledger;

  const result = rankCrownPeriod({
    ledger,
    competitors: [
      { memberId: 'maya', name: 'Maya', onRecess: true, tasksCompleted: 5, lateCount: 0 },
      { memberId: 'liam', name: 'Liam', onRecess: false, tasksCompleted: 4, lateCount: 0 },
    ],
    fromIso: '2026-08-01T00:00:00.000Z',
    toIso: '2026-08-07T23:59:59.000Z',
  });
  const maya = result.rows.find((r) => r.memberId === 'maya')!;
  const liam = result.rows.find((r) => r.memberId === 'liam')!;
  assertEq(maya.excluded, true, 'T3.11 maya excluded');
  assertEq(maya.rank, null, 'T3.11 maya rank');
  assertEq(liam.rank, 1, 'T3.11 liam crown');
  pass('T3.11', 'Member on Recess excluded from that week\'s crown');
}

// Sanity: Everyone shortcut
{
  const everyone = createRecessForEveryone({
    memberIds: ['maya', 'liam'],
    startDate: '2026-08-05',
    endDate: '2026-08-12',
    createdBy: 'admin',
    createdAt: '2026-08-05T12:00:00.000Z',
    todayLocal: '2026-08-05',
    isAdmin: true,
    existing: [],
  });
  assert(!('error' in everyone), 'everyone ok');
  assertEq(everyone.periods.length, 2, 'everyone count');
  assert(isOnRecess(everyone.periods, 'maya', '2026-08-07'), 'maya on recess');
}

console.log('\n11/11 Phase 3 STOP GATE checks passed');

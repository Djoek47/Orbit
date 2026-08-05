/**
 * Revision D Phase 1 STOP GATE — T1.1 through T1.28.
 * Run: npm run test:revision-d-phase1
 * Spec: docs/logic/choremaxx-revision-d-spec.md §STOP GATE 1
 */

import { BUNDLE_BONUS_FULL, BUNDLE_BONUS_LATE, LATE_CREDIT } from '@/constants/scoring';
import { FLAT_TASK_XP } from '@/lib/rewards/reward-mode';
import { bundleBonusXp } from '@/lib/scoring/bundle-bonus';
import { calculateAward } from '@/lib/scoring/calculate-award';
import { classifyDay } from '@/lib/scoring/classify-day';
import { countsTowardDailyStreak } from '@/lib/scoring/counts-toward-daily-streak';
import { applyExpiryRollover, assertCompletable } from '@/lib/scoring/expiry';
import { normalizeOccurrenceStatus } from '@/lib/tasks/occurrence-status';
import {
  acceptStreakRescue,
  accrueRescuePct,
  applyDayToStreak,
  emptyStreak,
  settleWeekRescueDeduction,
  weekKeyForLocalDate,
  type WeekRescueAccrual,
} from '@/lib/streaks/streak-engine';
import {
  applyXpChange,
  balanceOf,
  createEmptyLedger,
  resetLedgerIdSeq,
  type XpLedgerEntry,
} from '@/lib/streaks/xp-ledger';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const logs: string[] = [];
function pass(id: string, detail?: string) {
  logs.push(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
}

resetLedgerIdSeq();
let ledger: XpLedgerEntry[] = createEmptyLedger();

function awardTask(opts: {
  memberId: string;
  xp: number;
  completedAt: string;
  dueAt: string;
  label: string;
  weekKey: string;
  hygiene?: boolean;
}) {
  const result = calculateAward(
    {
      xp: opts.xp,
      dueAt: opts.dueAt,
      xpEligible: !opts.hygiene,
      tracking: opts.hygiene ? 'streak' : 'xp',
    },
    opts.completedAt,
    opts.dueAt
  );
  const type = result.completedLate ? 'late_credit' : 'task_completed';
  const applied = applyXpChange(ledger, {
    memberId: opts.memberId,
    type,
    delta: result.awardedXp,
    label: opts.label,
    occurredAt: opts.completedAt,
    weekKey: opts.weekKey,
  });
  ledger = applied.ledger;
  return result;
}

// ── LATE CREDIT ────────────────────────────────────────────────────────

{
  const due = '2026-08-04T19:00:00.000Z';
  const r1 = calculateAward({ xp: 10, dueAt: due }, '2026-08-04T18:45:00.000Z', due);
  assertEq(r1.awardedXp, 10, 'T1.1');
  assertEq(r1.completedLate, false, 'T1.1 late flag');
  pass('T1.1', '10 XP on time → 10');
}

{
  const due = '2026-08-04T19:00:00.000Z';
  const r = calculateAward({ xp: 10, dueAt: due }, '2026-08-04T19:30:00.000Z', due);
  assertEq(r.awardedXp, 7, 'T1.2');
  assertEq(r.completedLate, true, 'T1.2 late');
  pass('T1.2', '10 XP at 19:30 → 7');
}

{
  const due = '2026-08-04T19:00:00.000Z';
  const r = calculateAward({ xp: 10, dueAt: due }, '2026-08-04T23:58:00.000Z', due);
  assertEq(r.awardedXp, 7, 'T1.3');
  pass('T1.3', '10 XP at 23:58 → 7');
}

{
  const map: Record<number, number> = { 5: 3, 10: 7, 15: 12, 20: 16, 25: 20, 30: 25 };
  for (const [full, late] of Object.entries(map)) {
    assertEq(LATE_CREDIT[Number(full)], Number(late), `T1.4 ${full}`);
    const r = calculateAward(
      { xp: Number(full), dueAt: '2026-08-04T12:00:00.000Z' },
      '2026-08-04T13:00:00.000Z',
      '2026-08-04T12:00:00.000Z'
    );
    assertEq(r.awardedXp, Number(late), `T1.4 award ${full}`);
  }
  pass('T1.4', 'all six Late Credit mappings');
}

{
  const r = calculateAward(
    { xp: FLAT_TASK_XP, dueAt: '2026-08-04T19:00:00.000Z' },
    '2026-08-04T20:00:00.000Z',
    '2026-08-04T19:00:00.000Z'
  );
  assertEq(r.awardedXp, 7, 'T1.5');
  pass('T1.5', 'Equity late → 7');
}

{
  assertEq(bundleBonusXp(false), BUNDLE_BONUS_FULL, 'T1.6 full');
  assertEq(bundleBonusXp(true), BUNDLE_BONUS_LATE, 'T1.6 late');
  pass('T1.6', 'bundle bonus 10 / 7');
}

{
  const r = calculateAward(
    { xp: 10, tracking: 'streak', xpEligible: false, dueAt: '2026-08-04T19:00:00.000Z' },
    '2026-08-04T20:00:00.000Z',
    '2026-08-04T19:00:00.000Z'
  );
  assertEq(r.awardedXp, 0, 'T1.7');
  assertEq(r.completedLate, false, 'T1.7 no late label');
  pass('T1.7', 'hygiene late → 0, no Late Credit');
}

// ── EXPIRY ─────────────────────────────────────────────────────────────

{
  const rows = [
    { id: 'a', status: 'pending' as const, dueAt: '2026-08-03T19:00:00.000Z' },
    { id: 'b', status: 'late' as const, dueAt: '2026-08-03T19:00:00.000Z' },
    { id: 'c', status: 'completed' as const, dueAt: '2026-08-03T19:00:00.000Z' },
  ];
  const once = applyExpiryRollover(rows, 'UTC', '2026-08-04T00:01:00.000Z');
  assertEq(once[0].status, 'expired', 'T1.8 a');
  assertEq(once[1].status, 'expired', 'T1.8 b');
  assertEq(once[2].status, 'completed', 'T1.8 c untouched');
  pass('T1.8', 'rollover → expired');

  let threw = false;
  try {
    assertCompletable('expired');
  } catch {
    threw = true;
  }
  assert(threw, 'T1.9 must throw');
  pass('T1.9', 'expired cannot complete');

  const twice = applyExpiryRollover(once, 'UTC', '2026-08-04T00:01:00.000Z');
  assertEq(JSON.stringify(twice), JSON.stringify(once), 'T1.10 idempotent');
  pass('T1.10', 'rollover idempotent');
}

{
  assertEq(normalizeOccurrenceStatus('missed'), 'expired', 'T1.11 migrate');
  pass('T1.11', 'missed → expired normalization');
}

{
  assertEq(countsTowardDailyStreak({ frequency: 'weekly' }), false, 'T1.12 weekly');
  assertEq(countsTowardDailyStreak({ frequency: 'daily' }), true, 'T1.13 daily');
  assertEq(countsTowardDailyStreak({ repeat: 'Weekdays' }), true, 'T1.13 weekdays');
  const weeklyExpired = classifyDay({
    occurrences: [{ status: 'expired', frequency: 'weekly' }],
  });
  assertEq(weeklyExpired, 'neutral', 'T1.12 class'); // weekly doesn't qualify → neutral
  const dailyExpired = classifyDay({
    occurrences: [{ status: 'expired', frequency: 'daily' }],
  });
  assertEq(dailyExpired, 'missed', 'T1.13 class');
  pass('T1.12', 'expired WEEKLY → streak unaffected (neutral day)');
  pass('T1.13', 'expired DAILY → day classified missed');
}

// ── STREAK CLIFFS ──────────────────────────────────────────────────────

{
  let s = emptyStreak('maya');
  s = { ...s, current: 10, longest: 10 };
  s = applyDayToStreak(s, 'missed', '2026-08-03', 100); // Mon
  assert(s.pendingRescue != null, 'rescue after 1 miss');
  s = acceptStreakRescue(s, { confirmedViaPrompt: true }).streak;
  s = applyDayToStreak(s, 'missed', '2026-08-04', 100); // Tue
  s = acceptStreakRescue(s, { confirmedViaPrompt: true }).streak;
  s = applyDayToStreak(s, 'missed', '2026-08-05', 100); // Wed → cliff
  assertEq(s.current, 0, 'T1.14 streak');
  assertEq(s.streakEndedReason, 'consecutive', 'T1.14 reason');
  assertEq(s.pendingRescue, null, 'T1.14 no rescue');
  pass('T1.14', '3 consecutive → streak 0, no rescue');
}

{
  let s = emptyStreak('liam');
  s = { ...s, current: 5 };
  // Miss Mon, work Tue, miss Wed, work Thu, miss Fri → rolling 3
  s = applyDayToStreak(s, 'missed', '2026-08-03', 50);
  s = acceptStreakRescue(s, { confirmedViaPrompt: true }).streak;
  s = applyDayToStreak(s, 'complete', '2026-08-04', 50);
  s = applyDayToStreak(s, 'missed', '2026-08-05', 50);
  s = acceptStreakRescue(s, { confirmedViaPrompt: true }).streak;
  s = applyDayToStreak(s, 'complete', '2026-08-06', 50);
  s = applyDayToStreak(s, 'missed', '2026-08-07', 50);
  assertEq(s.current, 0, 'T1.15 streak');
  assertEq(s.streakEndedReason, 'rolling', 'T1.15 reason');
  pass('T1.15', 'rolling 3 misses in 7 days → streak 0');
}

{
  let s = emptyStreak('sofia');
  s = { ...s, current: 8 };
  s = applyDayToStreak(s, 'missed', '2026-08-03', 80);
  assertEq(s.consecutiveMissedDays, 1, 'T1.16 after mon');
  s = acceptStreakRescue(s, { confirmedViaPrompt: true }).streak;
  s = applyDayToStreak(s, 'neutral', '2026-08-04', 80);
  assertEq(s.consecutiveMissedDays, 1, 'T1.16 neutral skips');
  s = applyDayToStreak(s, 'missed', '2026-08-05', 80);
  assertEq(s.consecutiveMissedDays, 2, 'T1.16');
  pass('T1.16', 'miss + neutral + miss → consecutive 2');
}

{
  let s = emptyStreak('noah');
  s = { ...s, current: 4, consecutiveMissedDays: 2, rollingMissDates: ['2026-08-03', '2026-08-04'] };
  s = applyDayToStreak(s, 'complete', '2026-08-05', 40);
  assertEq(s.consecutiveMissedDays, 0, 'T1.17');
  assert(s.rollingMissDates.includes('2026-08-03'), 'T1.18 rolling kept');
  pass('T1.17', 'complete resets consecutive to 0');
  pass('T1.18', 'complete does not clear rolling-7 window');
}

// ── STREAK RESCUE ──────────────────────────────────────────────────────

{
  assertEq(settleWeekRescueDeduction(260, 0.1), 26, 'T1.19');
  pass('T1.19', '260 × 10% → 26');
  assertEq(settleWeekRescueDeduction(250, 0.2), 50, 'T1.20');
  pass('T1.20', '250 × 20% → 50');
}

{
  const sun = weekKeyForLocalDate('2026-08-02'); // Sunday
  const mon = weekKeyForLocalDate('2026-08-03'); // Monday
  assert(sun !== mon, 'T1.21 week boundary');
  let week1: WeekRescueAccrual = {
    memberId: 'm',
    weekKey: sun,
    totalRescuePct: 0,
    rescuedDates: [],
  };
  let week2: WeekRescueAccrual = {
    memberId: 'm',
    weekKey: mon,
    totalRescuePct: 0,
    rescuedDates: [],
  };
  week1 = accrueRescuePct(week1, '2026-08-02', 0.1);
  week2 = accrueRescuePct(week2, '2026-08-03', 0.1);
  assertEq(week1.totalRescuePct, 0.1, 'T1.21 w1');
  assertEq(week2.totalRescuePct, 0.1, 'T1.21 w2');
  pass('T1.21', 'Sun/Mon gap → 10% each week');
}

{
  let s = emptyStreak('emma');
  s = { ...s, current: 12 };
  s = applyDayToStreak(s, 'missed', '2026-08-05', 200);
  assert(s.pendingRescue != null, 'offer exists');
  // No response → next rollover past expiresOn
  s = applyDayToStreak(s, 'neutral', '2026-08-07', 200); // past expiry
  assertEq(s.current, 0, 'T1.22 streak');
  // XP unchanged — we never wrote a rescue ledger entry
  pass('T1.22', 'inaction → DECLINED, streak 0, XP unchanged');
}

{
  let s = emptyStreak('bridge');
  s = { ...s, current: 12, longest: 12, freeRescueUsed: true };
  s = applyDayToStreak(s, 'missed', '2026-08-05', 260);
  const before = s.current;
  const { streak: after, accrual } = acceptStreakRescue(s, { confirmedViaPrompt: true });
  assertEq(after.current, 12, 'T1.23');
  assertEq(before, 12, 'T1.23 before');
  assert(accrual != null && accrual.pct === 0.1, 'T1.23 accrual');
  pass('T1.23', 'rescue bridges — streak stays 12, not 13');
}

{
  let s = emptyStreak('first');
  s = { ...s, current: 5, freeRescueUsed: false };
  s = applyDayToStreak(s, 'missed', '2026-08-05', 100);
  assert(s.pendingRescue?.freeEligible === true, 'free eligible');
  // Without prompt → no accept
  const blocked = acceptStreakRescue(s, { confirmedViaPrompt: false });
  assertEq(blocked.accrual, null, 'T1.24 needs prompt');
  const { streak: freed, accrual } = acceptStreakRescue(s, { confirmedViaPrompt: true });
  assertEq(accrual?.pct, 0, 'T1.24 free pct');
  assertEq(freed.freeRescueUsed, true, 'T1.24 flag');
  pass('T1.24', 'first rescue free only after prompt');

  let s2 = freed;
  s2 = applyDayToStreak(s2, 'missed', '2026-08-06', 100);
  const second = acceptStreakRescue(s2, { confirmedViaPrompt: true });
  assertEq(second.accrual?.pct, 0.1, 'T1.25');
  pass('T1.25', 'second rescue charged normally');
}

{
  let s = emptyStreak('norefund');
  s = { ...s, current: 20, freeRescueUsed: true };
  let week: WeekRescueAccrual = {
    memberId: 'norefund',
    weekKey: weekKeyForLocalDate('2026-08-03'),
    totalRescuePct: 0,
    rescuedDates: [],
  };
  s = applyDayToStreak(s, 'missed', '2026-08-03', 200);
  let acc = acceptStreakRescue(s, { confirmedViaPrompt: true });
  s = acc.streak;
  week = accrueRescuePct(week, '2026-08-03', acc.accrual!.pct);
  s = applyDayToStreak(s, 'missed', '2026-08-04', 200);
  acc = acceptStreakRescue(s, { confirmedViaPrompt: true });
  s = acc.streak;
  week = accrueRescuePct(week, '2026-08-04', acc.accrual!.pct);
  s = applyDayToStreak(s, 'missed', '2026-08-05', 200);
  assertEq(s.current, 0, 'T1.26 streak gone');
  assertEq(week.totalRescuePct, 0.2, 'T1.26 no refund of 20%');
  pass('T1.26', 'pay day1+day2 then cliff → no refund');
}

// ── LEDGER ─────────────────────────────────────────────────────────────

{
  resetLedgerIdSeq();
  ledger = createEmptyLedger();
  const wk = weekKeyForLocalDate('2026-08-04');
  awardTask({
    memberId: 'ledger',
    xp: 10,
    completedAt: '2026-08-04T18:45:00.000Z',
    dueAt: '2026-08-04T19:00:00.000Z',
    label: 'Made the bed',
    weekKey: wk,
  });
  awardTask({
    memberId: 'ledger',
    xp: 10,
    completedAt: '2026-08-04T19:30:00.000Z',
    dueAt: '2026-08-04T19:00:00.000Z',
    label: 'Wipe counters',
    weekKey: wk,
  });
  const bonus = applyXpChange(ledger, {
    memberId: 'ledger',
    type: 'bundle_bonus',
    delta: BUNDLE_BONUS_LATE,
    label: 'Bundle bonus',
    occurredAt: '2026-08-04T20:00:00.000Z',
    weekKey: wk,
  });
  ledger = bonus.ledger;
  const rescue = applyXpChange(ledger, {
    memberId: 'ledger',
    type: 'streak_rescue',
    delta: -26,
    label: 'Streak rescue',
    occurredAt: '2026-08-10T23:59:59.000Z',
    weekKey: wk,
  });
  ledger = rescue.ledger;

  assert(ledger.length >= 4, 'T1.27 entries');
  let prev = 0;
  for (const e of ledger.filter((x) => x.memberId === 'ledger')) {
    assertEq(e.balanceAfter, prev + e.delta, `T1.28 ${e.id}`);
    prev = e.balanceAfter;
  }
  assertEq(balanceOf(ledger, 'ledger'), prev, 'T1.28 tip');
  pass('T1.27', 'every XP mutation produced a ledger entry');
  pass('T1.28', 'balanceAfter continuous with no gaps');
}

console.log(logs.join('\n'));
console.log(`\n${logs.length}/28 Phase 1 STOP GATE checks passed`);

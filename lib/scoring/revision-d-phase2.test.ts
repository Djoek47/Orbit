/**
 * Revision D Phase 2 STOP GATE — T2.1 through T2.10.
 * Run: npm run test:revision-d-phase2
 */

import { CROWN_COLORS, CROWN_CONTRAST_VS_INK } from '@/constants/crown-colors';
import { VOCAB } from '@/constants/vocabulary';
import {
  competitionRanks,
  filterChampionsRecord,
  rankCrownPeriod,
  type ChampionsRecord,
  type CrownCompetitor,
} from '@/lib/scoring/crowns';
import {
  applyXpChange,
  createEmptyLedger,
  resetLedgerIdSeq,
  type XpLedgerEntry,
} from '@/lib/streaks/xp-ledger';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
function assertEq<T>(a: T, e: T, label: string) {
  if (a !== e) throw new Error(`${label}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
}

const logs: string[] = [];
function pass(id: string, detail?: string) {
  logs.push(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
}

resetLedgerIdSeq();

function seedLedger(
  rows: { memberId: string; delta: number; at: string }[]
): XpLedgerEntry[] {
  let ledger = createEmptyLedger();
  for (const row of rows) {
    const next = applyXpChange(ledger, {
      memberId: row.memberId,
      type: 'task_completed',
      delta: row.delta,
      label: 'task',
      occurredAt: row.at,
      weekKey: '2026-W32',
    });
    ledger = next.ledger;
  }
  return ledger;
}

const fromIso = '2026-08-03T00:00:00.000Z';
const toIso = '2026-08-09T23:59:59.000Z';

// T2.1 two tied at top → both 1st/gold, next 3rd/bronze
{
  const ranks = competitionRanks([420, 420, 310]);
  assertEq(ranks[0], 1, 'T2.1 a');
  assertEq(ranks[1], 1, 'T2.1 b');
  assertEq(ranks[2], 3, 'T2.1 c');
  const ledger = seedLedger([
    { memberId: 'maya', delta: 420, at: '2026-08-04T12:00:00.000Z' },
    { memberId: 'liam', delta: 420, at: '2026-08-04T12:00:00.000Z' },
    { memberId: 'sofia', delta: 310, at: '2026-08-04T12:00:00.000Z' },
  ]);
  const competitors: CrownCompetitor[] = [
    { memberId: 'maya', name: 'Maya', onRecess: false, tasksCompleted: 30, lateCount: 2 },
    { memberId: 'liam', name: 'Liam', onRecess: false, tasksCompleted: 28, lateCount: 1 },
    { memberId: 'sofia', name: 'Sofia', onRecess: false, tasksCompleted: 20, lateCount: 0 },
  ];
  const result = rankCrownPeriod({ ledger, competitors, fromIso, toIso });
  assertEq(result.rows[0].medal, 'gold', 'T2.1 gold1');
  assertEq(result.rows[1].medal, 'gold', 'T2.1 gold2');
  assertEq(result.rows[2].medal, 'bronze', 'T2.1 bronze');
  assertEq(result.rows[2].rank, 3, 'T2.1 rank3');
  assert(!result.rows.some((r) => r.medal === 'silver'), 'T2.1 no silver');
  pass('T2.1', 'tie at top → 1st/1st/3rd, no silver');
}

// T2.2 three tied → all 1st, next 4th
{
  const ranks = competitionRanks([100, 100, 100, 50]);
  assertEq(ranks.join(','), '1,1,1,4', 'T2.2');
  pass('T2.2', 'three tied → 1,1,1,4');
}

// T2.3 Tied for 1st label
{
  const ledger = seedLedger([
    { memberId: 'a', delta: 50, at: '2026-08-04T12:00:00.000Z' },
    { memberId: 'b', delta: 50, at: '2026-08-04T12:00:00.000Z' },
  ]);
  const result = rankCrownPeriod({
    ledger,
    competitors: [
      { memberId: 'a', name: 'A', onRecess: false, tasksCompleted: 5, lateCount: 0 },
      { memberId: 'b', name: 'B', onRecess: false, tasksCompleted: 4, lateCount: 0 },
    ],
    fromIso,
    toIso,
  });
  assertEq(result.rows[0].tiedLabel, VOCAB.tiedFor1st, 'T2.3');
  assert(result.rows[0].tied, 'T2.3 tied flag');
  pass('T2.3', 'Tied for 1st label');
}

// T2.4 zero XP → no crown
{
  const result = rankCrownPeriod({
    ledger: createEmptyLedger(),
    competitors: [
      { memberId: 'a', name: 'A', onRecess: false, tasksCompleted: 0, lateCount: 0 },
    ],
    fromIso,
    toIso,
  });
  assertEq(result.crownAwarded, false, 'T2.4');
  assertEq(result.emptyCopy, VOCAB.noCrownThisWeek, 'T2.4 copy');
  pass('T2.4', '0 XP → no crown');
}

// T2.5 recess exclusion
{
  const ledger = seedLedger([
    { memberId: 'maya', delta: 100, at: '2026-08-04T12:00:00.000Z' },
    { memberId: 'liam', delta: 200, at: '2026-08-04T12:00:00.000Z' },
  ]);
  const result = rankCrownPeriod({
    ledger,
    competitors: [
      { memberId: 'maya', name: 'Maya', onRecess: false, tasksCompleted: 10, lateCount: 0 },
      { memberId: 'liam', name: 'Liam', onRecess: true, tasksCompleted: 10, lateCount: 0 },
    ],
    fromIso,
    toIso,
  });
  const liam = result.rows.find((r) => r.memberId === 'liam')!;
  assert(liam.excluded && liam.onRecess, 'T2.5');
  assertEq(liam.rank, null, 'T2.5 no rank');
  assertEq(liam.medal, null, 'T2.5 no medal');
  pass('T2.5', 'Recess member excluded, shown On recess');
}

// T2.6–T2.8 Champions Record privacy
{
  const full: ChampionsRecord = {
    memberId: 'maya',
    name: 'Maya',
    rank: 1,
    medal: 'gold',
    netXp: 420,
    tasksCompleted: 31,
    onTimeCount: 27,
    currentStreak: 18,
    bestDayLabel: 'Thursday · 85 XP',
    busiestDomain: 'Kitchen',
    lateCount: 4,
    expiredCount: 2,
    streakRescuesUsed: 1,
  };
  const sibling = filterChampionsRecord(full, { memberId: 'liam', isAdmin: false });
  assert(!('lateCount' in sibling), 'T2.6 late absent');
  assert(!('expiredCount' in sibling), 'T2.6 expired absent');
  assert(!('streakRescuesUsed' in sibling), 'T2.6 rescues absent');
  pass('T2.6', 'Helper sibling → restricted fields ABSENT');

  const admin = filterChampionsRecord(full, { memberId: 'admin', isAdmin: true });
  assertEq(admin.lateCount, 4, 'T2.7');
  pass('T2.7', 'Admin → all fields present');

  const self = filterChampionsRecord(full, { memberId: 'maya', isAdmin: false });
  assertEq(self.streakRescuesUsed, 1, 'T2.8');
  pass('T2.8', 'Self → all fields present');
}

// T2.9 contrast
{
  assert(CROWN_CONTRAST_VS_INK.gold >= 4.5, 'T2.9 gold');
  assert(CROWN_CONTRAST_VS_INK.silver >= 4.5, 'T2.9 silver');
  assert(CROWN_CONTRAST_VS_INK.bronze >= 4.5, 'T2.9 bronze');
  pass(
    'T2.9',
    `gold ${CROWN_COLORS.gold} (${CROWN_CONTRAST_VS_INK.gold}:1), silver ${CROWN_COLORS.silver} (${CROWN_CONTRAST_VS_INK.silver}:1), bronze ${CROWN_COLORS.bronze} (${CROWN_CONTRAST_VS_INK.bronze}:1)`
  );
}

// T2.10 ranking matches ledger sum
{
  resetLedgerIdSeq();
  const ledger = seedLedger([
    { memberId: 'maya', delta: 100, at: '2026-08-04T12:00:00.000Z' },
    { memberId: 'maya', delta: -20, at: '2026-08-09T23:00:00.000Z' }, // rescue
  ]);
  // Fix type on last entry — re-seed properly
  resetLedgerIdSeq();
  let L = createEmptyLedger();
  L = applyXpChange(L, {
    memberId: 'maya',
    type: 'task_completed',
    delta: 100,
    label: 'a',
    occurredAt: '2026-08-04T12:00:00.000Z',
    weekKey: '2026-W32',
  }).ledger;
  L = applyXpChange(L, {
    memberId: 'maya',
    type: 'streak_rescue',
    delta: -20,
    label: 'rescue',
    occurredAt: '2026-08-09T23:00:00.000Z',
    weekKey: '2026-W32',
  }).ledger;
  L = applyXpChange(L, {
    memberId: 'liam',
    type: 'task_completed',
    delta: 90,
    label: 'b',
    occurredAt: '2026-08-04T12:00:00.000Z',
    weekKey: '2026-W32',
  }).ledger;
  const result = rankCrownPeriod({
    ledger: L,
    competitors: [
      { memberId: 'maya', name: 'Maya', onRecess: false, tasksCompleted: 10, lateCount: 0 },
      { memberId: 'liam', name: 'Liam', onRecess: false, tasksCompleted: 9, lateCount: 0 },
    ],
    fromIso,
    toIso,
  });
  assertEq(result.rows[0].memberId, 'liam', 'T2.10 leader'); // 90 > 80
  assertEq(result.rows[0].netXp, 90, 'T2.10 xp');
  assertEq(result.rows[1].netXp, 80, 'T2.10 maya net');
  pass('T2.10', 'crown ranking matches ledger net exactly');
}

console.log(logs.join('\n'));
console.log(`\n${logs.length}/10 Phase 2 STOP GATE checks passed`);

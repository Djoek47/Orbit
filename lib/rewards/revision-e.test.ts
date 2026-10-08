/**
 * Revision E ledger + week-boundary tests.
 */
import assert from 'node:assert/strict';

import { INTRO_SLOGANS } from '@/constants/vocabulary';
import { toSentenceValue } from '@/constants/notifications';
import {
  __resetLedgersForTests,
  applyAllowanceChange,
  applyRewardChange,
  formatMoney,
  householdWeekBounds,
  isIsoInHouseholdWeek,
  listAllowanceLedger,
  listRewardLedger,
  summarizeAllowanceLedger,
  summarizeRewardLedger,
} from '@/lib/rewards/ledgers';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

async function main() {
  __resetLedgersForTests();

  {
    assert.equal(INTRO_SLOGANS.length, 3);
    assert.equal(INTRO_SLOGANS[0], 'Built for real families with high standards.');
    assert.equal(INTRO_SLOGANS[2], 'Poppins keeps the whole house in step.');
    pass('E1', 'INTRO_SLOGANS exact set');
  }

  {
    assert.equal(toSentenceValue('Additional screen time'), 'additional screen time');
    pass('E2', 'toSentenceValue lower-cases mid-sentence values');
  }

  {
    // Sunday 23:30 America/Toronto in August 2026 (EDT = UTC-4)
    // 2026-08-09 is a Sunday. 23:30 Toronto = 2026-08-10T03:30:00.000Z
    const iso = '2026-08-10T03:30:00.000Z';
    const week = householdWeekBounds(iso, 'America/Toronto');
    assert.equal(week.periodStart, '2026-08-03', 'week start');
    assert.equal(week.periodEnd, '2026-08-09', 'week end');
    assert.equal(isIsoInHouseholdWeek(iso, 'America/Toronto', week), true, 'in week');
    pass('E3', 'Sunday 23:30 Toronto stays in that week');
  }

  {
    __resetLedgersForTests();
    const pending = await applyRewardChange({
      id: 'r1',
      householdId: 'hh1',
      memberId: 'm1',
      rewardId: 'rw1',
      rewardName: 'Extra screen time',
      origin: 'requested',
      status: 'pending',
    });
    assert.equal(pending.status, 'pending');
    await applyRewardChange({
      id: 'r1',
      householdId: 'hh1',
      memberId: 'm1',
      rewardId: 'rw1',
      rewardName: 'Renamed later',
      origin: 'requested',
      status: 'approved',
    });
    const rows = await listRewardLedger('hh1');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rewardName, 'Extra screen time', 'snapshot preserved');
    assert.equal(rows[0].status, 'approved');
    const stats = summarizeRewardLedger(rows);
    assert.equal(stats.waiting, 0);
    assert.equal(stats.approved, 1);
    assert.equal(stats.declined, 0);
    pass('E4', 'reward ledger write/read + name snapshot');
  }

  {
    __resetLedgersForTests();
    await applyAllowanceChange({
      id: 'a1',
      householdId: 'hh1',
      memberId: 'm1',
      amount: 5,
      currency: 'USD',
      status: 'owed',
      timeZone: 'America/Toronto',
      asOfIso: '2026-08-10T03:30:00.000Z',
      amountLabel: '$5',
    });
    await applyAllowanceChange({
      id: 'a1',
      householdId: 'hh1',
      memberId: 'm1',
      amount: 5,
      status: 'paid',
      timeZone: 'America/Toronto',
      asOfIso: '2026-08-10T03:30:00.000Z',
    });
    const rows = await listAllowanceLedger('hh1', {
      timeZone: 'America/Toronto',
      thisWeekOnly: true,
    });
    assert.ok(rows.length >= 1, 'row present');
    const stats = summarizeAllowanceLedger(rows);
    assert.equal(stats.paid, 5);
    assert.equal(formatMoney(15, 'USD'), '$15');
    pass('E5', 'allowance ledger Sunday approve appears in that week');
  }

  console.log('\nAll revision-e ledger tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * A4 — Rewards smoke path (unit-level).
 * Hold & Request gate + allowance Mark as paid ledger write.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { canRequestReward, blockedRequestCopy } from '@/lib/rewards/can-request-reward';
import {
  __resetLedgersForTests,
  applyAllowanceChange,
  listAllowanceLedger,
} from '@/lib/rewards/ledgers';
import type { HouseholdTask } from '@/types/orbit';

function task(partial: Partial<HouseholdTask> & Pick<HouseholdTask, 'id' | 'title' | 'status'>): HouseholdTask {
  return {
    category: 'chores',
    assignee: 'Liam',
    due: 'Today',
    xp: 10,
    repeat: 'Daily',
    ...partial,
  } as HouseholdTask;
}

test('A4 gate blocks when daily task open', () => {
  const gate = canRequestReward('Liam', [
    task({ id: 't1', title: 'Dishes', status: 'Pending', assignee: 'Liam', repeat: 'Daily' }),
  ]);
  assert.equal(gate.allowed, false);
  assert.ok(gate.remaining.tasks >= 1);
  const copy = blockedRequestCopy(gate);
  assert.match(copy.title, /Not just yet/i);
});

test('A4 gate allows when daily tasks complete', () => {
  const gate = canRequestReward('Liam', [
    task({ id: 't1', title: 'Dishes', status: 'Completed', assignee: 'Liam', repeat: 'Daily' }),
  ]);
  assert.equal(gate.allowed, true);
});

test('A4 allowance Mark as paid writes ledger', async () => {
  __resetLedgersForTests();
  const owed = await applyAllowanceChange({
    householdId: 'hh1',
    memberId: 'm-liam',
    amount: 10,
    currency: 'CAD',
    status: 'owed',
    note: 'Weekly allowance',
  });
  assert.equal(owed.status, 'owed');
  const paid = await applyAllowanceChange({
    id: owed.id,
    householdId: 'hh1',
    memberId: 'm-liam',
    amount: 10,
    currency: 'CAD',
    status: 'paid',
    markedPaidBy: 'admin',
  });
  assert.equal(paid.status, 'paid');
  assert.ok(paid.markedPaidAt);
  const rows = await listAllowanceLedger('hh1');
  assert.equal(rows.find((r) => r.id === owed.id)?.status, 'paid');
  __resetLedgersForTests();
});

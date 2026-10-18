/**
 * WO11 §4 — late replace during a live chain appends; duplicates drop.
 * Run: npx tsx lib/poppins/chain-queue.test.ts
 */
import assert from 'node:assert/strict';

import { clearActLedger, filterDuplicateUiActions, recordCommittedAct } from '@/lib/poppins/act-ledger';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';

clearActLedger();
poppinsUiOrchestrator.clear();

const warns: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  warns.push(String(args[0] ?? ''));
};

poppinsUiOrchestrator.drive(
  [
    { type: 'add_grocery', name: 'Milk' },
    { type: 'add_grocery', name: 'Eggs' },
    { type: 'add_grocery', name: 'Bread' },
  ],
  { replace: true }
);

const before = poppinsUiOrchestrator.getState();
assert.equal(before.live, true);
assert.ok(before.playlist.length >= 1, 'grouped grocery live');
const firstId = before.playlist[0]?.id;
const lenBefore = before.playlist.length;

// Late model plan with replace:true must NOT restart.
poppinsUiOrchestrator.drive(
  [
    { type: 'add_grocery', name: 'Milk' },
    { type: 'add_grocery', name: 'Bananas' },
  ],
  { replace: true }
);

const after = poppinsUiOrchestrator.getState();
assert.equal(after.playlist[0]?.id, firstId, 'head beat identity preserved');
assert.equal(after.index, before.index, 'index not reset');
assert.ok(
  warns.some((line) => line.includes('iui.chain_replaced_blocked')),
  'logs chain_replaced_blocked'
);

// Duplicate Milk dropped via ledger-style identity; Bananas may append as queued row/beat.
const labels = after.playlist.flatMap((beat) => {
  if (beat.scene === 'result_mark') return [];
  if (beat.payload.items?.length) return beat.payload.items.map((item) => item.label.toLowerCase());
  const name = (beat.payload.groceryName ?? beat.payload.title ?? '').toLowerCase();
  return name ? [name] : [];
});
const milkCount = labels.filter((label) => label === 'milk').length;
assert.equal(milkCount, 1, `Milk not duplicated, got ${JSON.stringify(labels)}`);
assert.ok(
  labels.some((label) => label.includes('banana')),
  `Bananas appended, got ${JSON.stringify(labels)}`
);
assert.ok(
  labels.some((label) => label.includes('egg')),
  `Eggs preserved, got ${JSON.stringify(labels)}`
);

// Ledger path: already-committed act in a late plan is dropped by filter (WO10).
recordCommittedAct('add_grocery', 'bananas');
const filtered = filterDuplicateUiActions([
  { type: 'add_grocery', name: 'Bananas' },
  { type: 'add_grocery', name: 'Butter' },
]);
assert.equal(filtered.length, 1);
assert.equal(String(filtered[0]?.name), 'Butter');

console.warn = originalWarn;
poppinsUiOrchestrator.clear();
clearActLedger();
console.log('chain-queue.test.ts ok');

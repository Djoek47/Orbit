/**
 * Run: npx --yes tsx lib/poppins/narrow-undo.test.ts
 */
import assert from 'node:assert/strict';

import {
  groceryAddActionsFromUtterance,
  matchGroceryCatalog,
  narrowGroceryChoices,
} from '@/lib/poppins/catalog-match';
import { bestFuzzyMatch, nearTieFuzzyMatches } from '@/lib/poppins/fuzzy-match';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { mapUiActionsToPlaylist } from '@/lib/poppins/ui-tool-map';
import type { IuiBeat } from '@/lib/poppins/ui-scenes';
import type { IuiCommitReverse } from '@/lib/poppins/iui-reverse';

// —— Narrow: jam / ham near-tie ——
const jamHam = [
  { key: 'jam', value: 'Jam' },
  { key: 'ham', value: 'Ham' },
];
assert.equal(bestFuzzyMatch('kam', jamHam), null, 'near-tie refuses a pick');
const tie = nearTieFuzzyMatches('kam', jamHam);
assert.ok(tie);
assert.equal(tie![0]!.value, 'Jam');
assert.equal(tie![1]!.value, 'Ham');

assert.equal(bestFuzzyMatch('jam', jamHam)?.value, 'Jam', 'confident match skips Narrow');
assert.equal(nearTieFuzzyMatches('jam', jamHam), null);

const narrow = narrowGroceryChoices('kam');
assert.ok(narrow);
assert.equal(narrow!.length, 2);
assert.ok(narrow!.some((c) => /jam/i.test(c.label)));
assert.ok(narrow!.some((c) => /ham/i.test(c.label)));
assert.equal(narrowGroceryChoices('jam'), null, 'exact jam is confident');
assert.equal(matchGroceryCatalog('jam')?.name, 'Jam');

const kamActs = groceryAddActionsFromUtterance('add kam to the list');
assert.ok(kamActs);
assert.equal(kamActs![0]?.provisional, true);
assert.equal((kamActs![0]?.chips as unknown[])?.length, 2);

const intent = parseHouseholdIntent('add kam to the list');
assert.equal(intent[0]?.provisional, true);
assert.equal((intent[0]?.chips as unknown[])?.length, 2);

const playlist = mapUiActionsToPlaylist(kamActs!);
assert.equal(playlist[0]?.scene, 'grocery_add');
assert.equal(playlist[0]?.commit, 'hold');
assert.equal(playlist[0]?.payload.provisional, true);
assert.equal(playlist[0]?.payload.chips?.length, 2);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.drive(kamActs!);
assert.equal(poppinsUiOrchestrator.getState().phase, 'narrow');
poppinsUiOrchestrator.chooseFromTap(
  { groceryName: 'Jam', title: 'Jam', provisional: false, composeReady: true },
  'Jam',
  'chip'
);
assert.notEqual(poppinsUiOrchestrator.getState().phase, 'narrow');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.groceryName, 'Jam');
assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.provisional, false);
poppinsUiOrchestrator.clear();

const jamActs = groceryAddActionsFromUtterance('add jam to the list');
assert.ok(jamActs);
assert.notEqual(jamActs![0]?.provisional, true);
poppinsUiOrchestrator.drive(jamActs!);
assert.notEqual(poppinsUiOrchestrator.getState().phase, 'narrow');
poppinsUiOrchestrator.clear();

// —— Per-row undo ——
const milkBeat: IuiBeat = {
  id: 'beat-milk',
  scene: 'grocery_add',
  phase: 'settle',
  commit: 'hold',
  payload: {
    write: 'add_grocery',
    groceryName: 'Milk',
    title: 'Milk',
    items: [
      { id: 'i1', label: 'Milk', status: 'done' },
      { id: 'i2', label: 'Eggs', status: 'done' },
    ],
  },
};
const batchReverse: IuiCommitReverse = {
  write: 'add_grocery',
  entityId: 'g-milk',
  beatId: 'beat-milk',
  batch: [
    { write: 'add_grocery', entityId: 'g-milk', beatId: 'beat-milk' },
    { write: 'add_grocery', entityId: 'g-eggs', beatId: 'beat-milk' },
  ],
};

const undone: string[] = [];
poppinsUiOrchestrator.setUndoHandler(async (_beat, reverse) => {
  if (reverse?.batch?.length) {
    for (const child of [...reverse.batch].reverse()) {
      undone.push(child.entityId);
    }
  } else if (reverse?.entityId) {
    undone.push(reverse.entityId);
  }
});

// Seed undo ledger via private state path: drive a result_mark with armUndoWindow by settling.
// Directly exercise undoOne after manually seeding through undoLast path:
// Use restore-like drive then inject via settle simulation — call undo APIs after setting handler
// by driving two grocery acts and mocking commit.
poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setCommitHandler(async (beat) => {
  if (beat.payload.items && beat.payload.items.length > 1) {
    return {
      ok: true as const,
      reverse: batchReverse,
    };
  }
  return {
    ok: true as const,
    reverse: {
      write: 'add_grocery' as const,
      entityId: `g-${beat.payload.groceryName ?? 'x'}`,
      beatId: beat.id,
    },
  };
});

poppinsUiOrchestrator.drive([
  {
    type: 'add_grocery',
    name: 'Milk',
    items: [
      { id: 'i1', label: 'Milk' },
      { id: 'i2', label: 'Eggs' },
    ],
  },
]);

void (async () => {
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  assert.ok(poppinsUiOrchestrator.undoCount() >= 2, 'batch undo count');
  const rows = poppinsUiOrchestrator.undoLedgerRows();
  assert.ok(rows.length >= 2, `expected per-row ledger, got ${rows.length}`);
  undone.length = 0;
  const firstId = rows[0]!.id;
  assert.equal(await poppinsUiOrchestrator.undoOne(firstId), true);
  assert.equal(undone.length, 1, 'undo one reverses one child');
  assert.ok(poppinsUiOrchestrator.undoCount() >= 1, 'remaining rows stay');
  undone.length = 0;
  assert.equal(await poppinsUiOrchestrator.undoLast(), true);
  assert.ok(undone.length >= 1, 'undo all clears remaining');
  assert.equal(poppinsUiOrchestrator.undoCount(), 0);
  poppinsUiOrchestrator.clear();
  poppinsUiOrchestrator.setCommitHandler(null);
  poppinsUiOrchestrator.setUndoHandler(null);

  void milkBeat;

  console.log('narrow-undo.test.ts: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

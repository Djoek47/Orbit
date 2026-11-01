/**
 * WO11 §4 — turn-level undo reverses every commit in the turn, newest first.
 * Run: npx tsx lib/poppins/turn-undo.test.ts
 */
import assert from 'node:assert/strict';

import { reverseIuiCommit } from '@/lib/poppins/iui-reverse';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';

async function main() {
  poppinsUiOrchestrator.clear();

  const reversed: string[] = [];

  poppinsUiOrchestrator.setUndoHandler(async (_beat, reverse) => {
    if (reverse) {
      await reverseIuiCommit(reverse, {
        removeGroceryItem: async (id) => {
          reversed.push(id);
        },
      });
    }
  });

  poppinsUiOrchestrator.setCommitHandler(async () => ({
    reverse: {
      write: 'add_grocery' as const,
      entityId: 'g-bread',
      beatId: 'group',
      batch: [
        { write: 'add_grocery' as const, entityId: 'g-milk' },
        { write: 'add_grocery' as const, entityId: 'g-eggs' },
        { write: 'add_grocery' as const, entityId: 'g-bread' },
      ],
    },
  }));

  poppinsUiOrchestrator.drive(
    [
      { type: 'add_grocery', name: 'Milk' },
      { type: 'add_grocery', name: 'Eggs' },
      { type: 'add_grocery', name: 'Bread' },
    ],
    { replace: true }
  );

  assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.items?.length, 3);

  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 40));

  assert.equal(poppinsUiOrchestrator.undoCount(), 3, 'Undo 3 things');
  assert.ok(
    poppinsUiOrchestrator.getState().undoUntil &&
      Date.now() < (poppinsUiOrchestrator.getState().undoUntil as number),
    'undo window armed from last commit'
  );

  const ok = await poppinsUiOrchestrator.undoLast();
  assert.equal(ok, true);
  assert.deepEqual(reversed, ['g-bread', 'g-eggs', 'g-milk'], 'newest first');
  assert.equal(poppinsUiOrchestrator.undoCount(), 0);

  // Second turn: successive commits accumulate on the ledger.
  reversed.length = 0;
  let n = 0;
  const ids = ['a', 'b', 'c'];
  poppinsUiOrchestrator.clear();
  poppinsUiOrchestrator.setCommitHandler(async () => {
    const entityId = ids[n++] ?? `x-${n}`;
    return { reverse: { write: 'add_grocery' as const, entityId } };
  });
  poppinsUiOrchestrator.drive([{ type: 'add_grocery', name: 'Milk' }], { replace: true });
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 20));
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 20));

  poppinsUiOrchestrator.drive([{ type: 'add_grocery', name: 'Butter' }], { replace: false });
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 20));
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 20));

  poppinsUiOrchestrator.drive([{ type: 'add_grocery', name: 'Jam' }], { replace: false });
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  await new Promise((r) => setTimeout(r, 20));

  assert.ok(
    poppinsUiOrchestrator.undoCount() >= 2,
    `ledger grew, got ${poppinsUiOrchestrator.undoCount()}`
  );
  await poppinsUiOrchestrator.undoLast();
  const expectedNewestFirst = ids.slice(0, n).reverse();
  assert.deepEqual(reversed, expectedNewestFirst);

  poppinsUiOrchestrator.setCommitHandler(null);
  poppinsUiOrchestrator.setUndoHandler(null);
  poppinsUiOrchestrator.clear();
  console.log('turn-undo.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

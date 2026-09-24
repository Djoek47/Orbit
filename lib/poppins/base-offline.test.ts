/**
 * WO15 §2 — askPoppins throwing still commits a local grocery act.
 * Run: npx --yes tsx lib/poppins/base-offline.test.ts
 */
import assert from 'node:assert/strict';

import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';

async function main() {
  poppinsUiOrchestrator.reset();

  const result = await resolveBaseUtterance('add jam to the list', {
    memberNames: ['Nero', 'Mia'],
    ask: async () => {
      throw new Error('model down');
    },
  });

  assert.equal(result.calledModel, false, 'must not need the chat model for an act');
  assert.equal(result.tookLocal, true);
  assert.match(result.answer, /Added jam to Groceries/i);

  const state = poppinsUiOrchestrator.getState();
  const write = state.playlist.find(
    (b) => b.scene === 'grocery_add' || b.payload.write === 'add_grocery'
  );
  assert.ok(write, 'IUI playlist must stage the grocery write');

  console.log('PASS base-offline');
}

void main();

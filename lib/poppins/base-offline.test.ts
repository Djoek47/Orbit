/**
 * WO15 §2 — askPoppins throwing still commits a local grocery act through iui-commit.
 * Run: npx --yes tsx lib/poppins/base-offline.test.ts
 */
import assert from 'node:assert/strict';

import { resolveBaseUtterance } from '@/lib/poppins/base-utterance';
import { commitIuiBeat } from '@/lib/poppins/iui-commit';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { HouseholdSnapshot } from '@/types/orbit';

async function main() {
  poppinsUiOrchestrator.clear();

  const result = await resolveBaseUtterance('add jam to the list', {
    memberNames: ['Nero', 'Mia'],
    ask: async () => {
      throw new Error('model down');
    },
  });

  assert.equal(result.calledModel, false, 'must not need the chat model for an act');
  assert.equal(result.tookLocal, true);
  assert.equal(result.kind, 'local_write');
  assert.match(result.answer, /Added jam to Groceries/i);

  const state = poppinsUiOrchestrator.getState();
  const write = state.playlist.find(
    (b) => b.scene === 'grocery_add' || b.payload.write === 'add_grocery'
  );
  assert.ok(write, 'IUI playlist must stage the grocery write');

  const landed: string[] = [];
  const household = {
    id: 'hh-base-offline',
    name: 'Test',
    tasks: [],
    events: [],
    groceries: [],
    members: [
      { id: 'm1', name: 'Nero', role: 'admin' },
      { id: 'm2', name: 'Mia', role: 'child' },
    ],
  } as unknown as HouseholdSnapshot;

  const committed = await commitIuiBeat(write!, {
    household,
    currentMember: household.members[0],
    createTask: async () => null,
    createEvent: async () => null,
    createItinerary: async () => null,
    addMissingGrocery: async (input) => {
      landed.push(input.name);
      return { id: `g-${input.name}`, name: input.name };
    },
    completeTask: async () => undefined,
    updateTask: async () => undefined,
    claimReward: async () => undefined,
    advanceItineraryStop: async () => undefined,
  });

  assert.equal(committed.ok, true, 'commit must succeed');
  assert.ok(
    landed.some((name) => /jam/i.test(name)),
    `jam must land on the list, got ${JSON.stringify(landed)}`
  );

  console.log('PASS base-offline');
}

void main();

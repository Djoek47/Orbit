/**
 * WO10 B4 — filler grocery/task names.
 * Run: npx tsx lib/poppins/filler-item-names.test.ts
 */
import assert from 'node:assert/strict';

import { FILLER_ITEM_NAMES, isFillerItemName, parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { parseCompoundHouseholdIntent } from '@/lib/poppins/clause-segment';

for (const word of FILLER_ITEM_NAMES) {
  assert.equal(isFillerItemName(word), true, word);
  assert.equal(isFillerItemName(word.toUpperCase()), true, word);
}

assert.equal(isFillerItemName('jam'), false);
assert.equal(isFillerItemName('milk'), false);

const something = parseCompoundHouseholdIntent(
  'cook dinner for tomorrow add something to the grocery list'
);
assert.ok(
  something.some((a) => String(a.type) === 'add_grocery' && !String(a.name ?? '').trim()),
  'filler grocery should stage empty name'
);
assert.ok(
  !something.some((a) => String(a.name ?? '').toLowerCase() === 'something'),
  'must not add literal Something'
);

for (const word of ['stuff', 'thing', 'things', 'it', 'that', 'some', 'anything']) {
  const out = parseHouseholdIntent(`add ${word} to the grocery list`);
  const grocery = out.find((a) => String(a.type) === 'add_grocery');
  assert.ok(grocery, `expected grocery for ${word}`);
  assert.equal(String(grocery!.name ?? '').trim(), '', word);
}

console.log('filler-item-names.test.ts ok');

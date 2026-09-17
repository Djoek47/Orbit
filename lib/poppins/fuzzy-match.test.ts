/**
 * Run: npx --yes tsx lib/poppins/fuzzy-match.test.ts
 */
import assert from 'node:assert/strict';

import { bestFuzzyMatch, levenshtein } from '@/lib/poppins/fuzzy-match';

assert.equal(levenshtein('dishes', 'diches'), 1);
assert.equal(levenshtein('dishes', 'dishs'), 1);
assert.equal(levenshtein('laundry', 'lawndry'), 1);
assert.equal(levenshtein('drako', 'draco'), 1);

const chores = [
  { key: 'dishes', value: 'Wash Dishes' },
  { key: 'laundry', value: 'Do Laundry' },
  { key: 'dishwasher', value: 'Load Dishwasher' },
];

const dishes = bestFuzzyMatch('diches', chores);
assert.equal(dishes?.value, 'Wash Dishes');

const laundry = bestFuzzyMatch('lawndry', chores);
assert.equal(laundry?.value, 'Do Laundry');

const roster = [
  { key: 'Drako', value: 'Drako' },
  { key: 'Maya', value: 'Maya' },
];
assert.equal(bestFuzzyMatch('Draco', roster)?.value, 'Drako');

const tie = bestFuzzyMatch('abx', [
  { key: 'abc', value: 'a' },
  { key: 'abd', value: 'b' },
]);
// Same distance near-tie should refuse a pick
assert.equal(tie, null);

console.log('PASS fuzzy-match');

/**
 * Run: npx --yes tsx lib/poppins/fuzzy-match.test.ts
 */
import assert from 'node:assert/strict';

import { bestFuzzyMatch, levenshtein, nearTieFuzzyMatches } from '@/lib/poppins/fuzzy-match';

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

const jamHam = nearTieFuzzyMatches('kam', [
  { key: 'jam', value: 'Jam' },
  { key: 'ham', value: 'Ham' },
]);
assert.ok(jamHam);
assert.equal(jamHam![0]!.value, 'Jam');
assert.equal(jamHam![1]!.value, 'Ham');
assert.equal(
  nearTieFuzzyMatches('jam', [
    { key: 'jam', value: 'Jam' },
    { key: 'ham', value: 'Ham' },
  ]),
  null,
  'confident match is not a near-tie'
);

console.log('PASS fuzzy-match');

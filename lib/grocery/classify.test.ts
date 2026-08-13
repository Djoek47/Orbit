/**
 * Revision C §4.3 classifier acceptance tests.
 */
import assert from 'node:assert/strict';

import {
  classifyGroceryItem,
  groupByAisle,
  withCategoryOverride,
} from '@/lib/grocery/classify';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

{
  const milk = classifyGroceryItem('Milk');
  assert.equal(milk.categoryName, 'Dairy & Eggs', 'Milk');
  const cake = classifyGroceryItem('Cake');
  assert.equal(cake.categoryName, 'Bakery', 'Cake');
  const steak = classifyGroceryItem('Steak');
  assert.equal(steak.categoryName, 'Meat & Seafood', 'Steak');
  pass('C4.1', 'Milk → Dairy, Cake → Bakery, Steak → Meat & Seafood');
}

{
  const peas = classifyGroceryItem('frozen peas');
  assert.equal(peas.categoryName, 'Frozen', 'frozen peas not Produce');
  const almond = classifyGroceryItem('almond milk');
  assert.equal(almond.categoryName, 'Dairy & Eggs');
  // Phrase must beat head-noun: "peas" alone is Produce
  assert.equal(classifyGroceryItem('peas').categoryName, 'Produce');
  pass('C4.2', 'longest-phrase-wins: frozen peas, almond milk');
}

{
  const chicken = classifyGroceryItem('2 lbs chicken');
  assert.equal(chicken.categoryName, 'Meat & Seafood');
  assert.equal(chicken.quantityDisplay, '2 lbs');
  assert.equal(chicken.itemName.toLowerCase(), 'chicken');
  pass('C4.3', '2 lbs chicken → Meat & Seafood with qty preserved');
}

{
  const organic = classifyGroceryItem('organic whole milk');
  assert.equal(organic.categoryName, 'Dairy & Eggs');
  pass('C4.4', 'head-noun: organic whole milk → Dairy');
}

{
  const unknown = classifyGroceryItem('xyzzyfoobar');
  assert.equal(unknown.categoryName, 'Other');
  assert.equal(unknown.confidence, 'fallback');
  pass('C4.5', 'unknown → Other fallback');
}

{
  const overrides = withCategoryOverride(null, 'special sauce', 'produce');
  const again = classifyGroceryItem('special sauce', overrides);
  assert.equal(again.categoryId, 'produce');
  assert.equal(again.confidence, 'override');
  pass('C4.6', 'household override checked before lexicon');
}

{
  const groups = groupByAisle([
    { category: 'Frozen', name: 'peas' },
    { category: 'Produce', name: 'bananas' },
    { category: 'Dairy & Eggs', name: 'milk' },
  ]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].categoryName, 'Produce');
  assert.equal(groups[1].categoryName, 'Dairy & Eggs');
  assert.equal(groups[2].categoryName, 'Frozen');
  pass('C4.7', 'aisle group order Produce → Dairy → Frozen');
}

console.log('\nAll grocery classify tests passed.');

/**
 * Canada catalog + search + suggest tests (no RN).
 */
import assert from 'node:assert/strict';

import { catalogSize, listBrowseCategories, aisleIdForBrowse } from '@/lib/grocery/catalog';
import { searchCatalog, __resetGrocerySearchIndex } from '@/lib/grocery/search-index';
import {
  listComplementSuggestions,
  listSuggestions,
} from '@/lib/grocery/suggest';
import { classifyGroceryItem } from '@/lib/grocery/classify';
import { emojiForGroceryItem } from '@/lib/grocery/item-emoji';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

__resetGrocerySearchIndex();

{
  assert.ok(catalogSize() >= 2400, `catalog ${catalogSize()}`);
  assert.ok(listBrowseCategories().length >= 25, 'browse categories');
  pass('GC1', 'Canada catalog size + browse set');
}

{
  const milk = searchCatalog('mi', 8);
  assert.ok(milk.some((p) => /milk/i.test(p.name)), 'mi → milk');
  const sham = searchCatalog('sh', 12);
  assert.ok(
    sham.some((p) => /shampoo|shreddies|shrimp|sugar/i.test(p.name)),
    'sh → shampoo-family'
  );
  assert.equal(searchCatalog('', 5).length, 0);
  pass('GC2', 'search mi/sh instant suggestions');
}

{
  for (const b of listBrowseCategories()) {
    const aisle = aisleIdForBrowse(b.id);
    assert.ok(aisle, `${b.id} maps to aisle`);
  }
  pass('GC3', 'browseCategory → 16-aisle map');
}

{
  const comps = listComplementSuggestions(['spaghetti', 'pasta'], 6);
  assert.ok(
    comps.some((p) => /sauce|parmesan|garlic/i.test(p.name)),
    'pasta → complements'
  );
  const cereal = listComplementSuggestions(['Shreddies'], 6);
  assert.ok(cereal.some((p) => /milk/i.test(p.name)), 'cereal → milk');
  pass('GC4', 'complements for pasta/cereal');
}

{
  const suggestions = listSuggestions({
    favorites: [],
    buyAgain: ['2% Milk'],
    onListNames: ['spaghetti'],
  });
  assert.ok(suggestions.length >= 1);
  assert.ok(!suggestions.some((p) => /spaghetti/i.test(p.name)));
  pass('GC5', 'suggestions exclude on-list');
}

{
  assert.equal(emojiForGroceryItem('Banana'), '🍌');
  assert.equal(emojiForGroceryItem('2% Milk'), '🥛');
  assert.equal(emojiForGroceryItem('Chicken Breasts'), '🍗');
  assert.equal(emojiForGroceryItem('Shampoo'), '🧴');
  assert.equal(emojiForGroceryItem('Potato Chips'), '🥔');
  assert.equal(emojiForGroceryItem('Apple Juice'), '🧃');
  const banana = searchCatalog('banana', 3)[0];
  assert.ok(banana);
  assert.equal(banana.icon, '🍌');
  pass('GC7', 'per-item emoji for common foods');
}

console.log('\nAll grocery-catalog tests passed.');

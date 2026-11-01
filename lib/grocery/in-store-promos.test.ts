/**
 * In-store promo matcher — US/CA grocery + clothing, no invented live prices.
 * Run: npx --yes tsx lib/grocery/in-store-promos.test.ts
 */
import assert from 'node:assert/strict';

import { inferRegionFromLabel, matchInStorePromos } from './in-store-promos';
import { shopKindFromOsmTag } from '@/lib/places/shop-kind';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

{
  assert.equal(inferRegionFromLabel('1410 Boul Henri-Bourassa E · Montréal, QC'), 'CA');
  assert.equal(inferRegionFromLabel('Target, Minneapolis, MN'), 'US');
  pass('region from address');
}

{
  const hits = matchInStorePromos({
    listNames: ['2% milk', 'Nike sneakers', 'oranges'],
    retailer: 'Winners',
    region: 'CA',
  });
  assert.ok(hits.some((h) => h.category === 'clothing' && /sneaker/i.test(h.item)));
  const milk = matchInStorePromos({
    listNames: ['Milk'],
    retailer: 'IGA',
    region: 'CA',
    category: 'grocery',
  });
  assert.equal(milk[0]?.retailer, 'IGA');
  pass('list items match in-store grocery and clothing offers');
}

{
  assert.equal(shopKindFromOsmTag('supermarket'), 'grocery');
  assert.equal(shopKindFromOsmTag('clothes'), 'clothing');
  assert.equal(shopKindFromOsmTag('department_store'), 'retail');
  assert.equal(shopKindFromOsmTag('unrelated'), null);
  pass('OSM shop tags map to grocery / clothing / retail');
}

console.log('\nin-store promo tests passed');

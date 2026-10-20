/**
 * The client and the server must agree on what a pack is worth.
 *
 * The client catalogue (constants/billing.ts) decides what the store page promises; the
 * grant-token-pack edge function decides what lands in the ledger. They are in different
 * runtimes and cannot share an import, so they drifted once already: the packs became
 * 700 / 2000 on the client while the server kept granting 600 / 1500.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { IAP_CONSUMABLES } from '../../constants/billing';

const fn = readFileSync('supabase/functions/grant-token-pack/index.ts', 'utf8');

function serverMap(name: string): Record<string, string> {
  const block = fn.match(new RegExp(`const ${name}[^{]*\\{([\\s\\S]*?)\\};`));
  assert.ok(block, `${name} is still declared in grant-token-pack`);
  const out: Record<string, string> = {};
  for (const m of block![1]!.matchAll(/(\w+):\s*'?([\w.]+)'?/g)) out[m[1]!] = m[2]!;
  return out;
}

const tokens = serverMap('PACK_TOKENS');
const products = serverMap('PACK_PRODUCTS');

for (const pack of Object.values(IAP_CONSUMABLES)) {
  assert.equal(
    Number(tokens[pack.pack]),
    pack.tokens,
    `${pack.pack}: the store says ${pack.tokens}, the server grants ${tokens[pack.pack]}`
  );
  assert.equal(
    products[pack.pack],
    pack.productId,
    `${pack.pack}: the server checks a different product id than the app sells`
  );
}

console.log('pack-parity: ok');

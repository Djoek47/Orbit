import assert from 'node:assert/strict';

import { IAP_CONSUMABLES } from '../../constants/billing';
import {
  buildOrderId,
  buildTopUpReceipt,
  clearReceiptInbox,
  fileReceipt,
  formatPerAction,
  formatPrice,
  latestReceipt,
  receiptBody,
  receiptInbox,
  receiptLine,
  receiptSubject,
  topUpPack,
  topUpPacks,
} from './topup-receipt';

// The packs are the real catalogue, in ascending size, with the real prices.
const packs = topUpPacks();
assert.equal(packs.length, 3);
assert.deepEqual(
  packs.map((p) => p.tokens),
  [200, 600, 1500]
);
assert.deepEqual(
  packs.map((p) => p.priceUsd),
  [1.99, 4.99, 9.99]
);
for (const pack of packs) {
  const source = IAP_CONSUMABLES[pack.key];
  assert.equal(pack.productId, source.productId, 'product id matches App Store Connect');
  assert.equal(pack.tokens, source.tokens);
  assert.equal(pack.priceUsd, source.priceUsd);
}

// Per-action price falls as the pack grows, and only the best one is flagged.
for (let i = 1; i < packs.length; i += 1) {
  assert.ok(packs[i]!.centsPerAction < packs[i - 1]!.centsPerAction, 'bigger is cheaper per action');
}
assert.equal(packs.filter((p) => p.best).length, 1);
assert.equal(packs[packs.length - 1]!.best, true);
assert.equal(packs[0]!.savingLabel, null, 'the smallest pack is the baseline');
assert.match(packs[1]!.savingLabel!, /^Save \d+%$/);
assert.equal(topUpPack('tokensMedium').tokens, 600);

// Prices read the way people expect.
assert.equal(formatPrice(4.99), '$4.99');
assert.equal(formatPrice(10), '$10.00');
assert.equal(formatPerAction(0.666), '0.67¢ each');
assert.equal(formatPerAction(1.25), '1.3¢ each');

// Order ids look like order ids, and the same purchase always produces the same one.
const id = buildOrderId(1_759_000_000_000);
assert.match(id, /^CMX-\d{4}-\d{4}-\d{4}$/);
assert.equal(buildOrderId(1_759_000_000_000), id, 'deterministic for one purchase');
assert.notEqual(buildOrderId(1_759_000_000_001), buildOrderId(1_759_000_009_999));

// A receipt carries the pack, the money and who it is for — and says it is a test.
const receipt = buildTopUpReceipt({
  packKey: 'tokensMedium',
  to: '  alex@example.com ',
  householdName: 'The Rivera house',
  at: '2026-09-30T18:04:00.000Z',
  seed: 1_759_000_000_000,
});
assert.equal(receipt.to, 'alex@example.com', 'the address is trimmed');
assert.equal(receipt.tokens, 600);
assert.equal(receipt.priceUsd, 4.99);
assert.equal(receipt.taxUsd, 0);
assert.equal(receipt.totalUsd, 4.99);
assert.equal(receipt.productId, IAP_CONSUMABLES.tokensMedium.productId);
assert.equal(receipt.mock, true);
assert.equal(receipt.transactionId, `mock-${receipt.orderId}`);
assert.match(receiptSubject(receipt), /600 Poppins actions/);

const body = receiptBody(receipt);
assert.match(body, /The Rivera house/);
assert.match(body, /\$4\.99/);
assert.match(body, new RegExp(receipt.orderId));
assert.match(body, /never expire/);
assert.match(body, /TEST PURCHASE — no card was charged/, 'it never pretends money moved');
assert.match(receiptLine(receipt), /600 actions · \$4\.99 · CMX-/);

// An empty household name still reads as a sentence.
assert.match(
  receiptBody(buildTopUpReceipt({ packKey: 'tokensSmall', to: 'a@b.c', householdName: '  ', seed: 4 })),
  /added to your household\./
);

// The inbox keeps receipts newest-first, and a repeated purchase can't be filed twice.
clearReceiptInbox();
assert.deepEqual(receiptInbox(), []);
assert.equal(latestReceipt(), null);
fileReceipt(receipt);
const second = buildTopUpReceipt({
  packKey: 'tokensLarge',
  to: 'alex@example.com',
  householdName: 'The Rivera house',
  seed: 99,
});
fileReceipt(second);
assert.equal(receiptInbox().length, 2);
assert.equal(latestReceipt()?.orderId, second.orderId, 'newest first');
fileReceipt(receipt);
assert.equal(receiptInbox().length, 2, 'filing the same order twice is a no-op');
clearReceiptInbox();
assert.equal(receiptInbox().length, 0);

console.log('topup-receipt: ok');

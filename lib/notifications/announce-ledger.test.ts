/**
 * Run: npx --yes tsx lib/notifications/announce-ledger.test.ts
 */
import assert from 'node:assert/strict';

import {
  hasLedgerKey,
  ledgerKeySet,
  pruneAnnounceLedger,
  toExpoNotificationIdentifier,
  withLedgerKey,
  ANNOUNCE_LEDGER_TTL_MS,
} from '@/lib/notifications/announce-ledger';

assert.match(toExpoNotificationIdentifier('note:n1'), /^orbit_note_n1$/);
assert.match(toExpoNotificationIdentifier('digest:tasks:2026-10-05:e1'), /^orbit_digest/);

let ledger = { entries: [] as { key: string; at: number }[] };
ledger = withLedgerKey(ledger, 'task:t1', 1_000);
assert.equal(hasLedgerKey(ledger, 'task:t1'), true);
assert.deepEqual([...ledgerKeySet(ledger)], ['task:t1']);
ledger = withLedgerKey(ledger, 'task:t1', 2_000);
assert.equal(ledger.entries.length, 1, 'dedupe keys');

const old = {
  entries: [
    { key: 'old', at: 0 },
    { key: 'fresh', at: ANNOUNCE_LEDGER_TTL_MS + 100 },
  ],
};
const pruned = pruneAnnounceLedger(old, ANNOUNCE_LEDGER_TTL_MS + 200);
assert.deepEqual(
  pruned.entries.map((e) => e.key),
  ['fresh']
);

console.log('announce-ledger: ok');

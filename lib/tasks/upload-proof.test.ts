/**
 * Proof URI classification — durable https vs device-local.
 */
import assert from 'node:assert/strict';

import { isLocalProofUri, isShareableProofUri } from './proof-uri';

assert.equal(isLocalProofUri('file:///var/mobile/Containers/Data/proof.jpg'), true);
assert.equal(isLocalProofUri('content://media/external/images/1'), true);
assert.equal(isLocalProofUri('ph://ASSET-ID'), true);
assert.equal(isLocalProofUri('/tmp/photo.jpg'), true);
assert.equal(
  isLocalProofUri('https://xyz.supabase.co/storage/v1/object/public/task-proofs/a/b.jpg'),
  false
);
assert.equal(isLocalProofUri(null), false);
assert.equal(isLocalProofUri(''), false);

assert.equal(
  isShareableProofUri('https://xyz.supabase.co/storage/v1/object/public/task-proofs/a/b.jpg'),
  true
);
assert.equal(isShareableProofUri('file:///tmp/x.jpg'), false);
assert.equal(isShareableProofUri(undefined), false);

console.log('proof-uri tests passed');

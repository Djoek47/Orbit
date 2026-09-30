/**
 * Proof upload helpers — local vs durable URIs.
 * Run: npx tsx lib/tasks/upload-proof.test.ts
 */
import assert from 'node:assert/strict';

import {
  isLocalProofUri,
  isShareableProofUri,
  needsProofUpload,
  proofBytesFromBase64,
} from '@/lib/tasks/proof-uri';

assert.equal(isLocalProofUri('file:///var/tmp/a.jpg'), true);
assert.equal(isLocalProofUri('ph://ABC'), true);
assert.equal(isLocalProofUri('content://media/1'), true);
assert.equal(isLocalProofUri('/var/mobile/Containers/Data/a.jpg'), true);
assert.equal(
  isLocalProofUri('https://x.supabase.co/storage/v1/object/public/task-proofs/h/t/1.jpg'),
  false
);

assert.equal(isShareableProofUri('https://cdn.example/p.jpg'), true);
assert.equal(isShareableProofUri('file:///x.jpg'), false);

assert.equal(needsProofUpload('file:///x.jpg'), true);
assert.equal(needsProofUpload('ph://ABC'), true);
assert.equal(needsProofUpload('https://cdn.example/p.jpg'), false);
assert.equal(needsProofUpload(''), false);

const roundTrip = proofBytesFromBase64(Buffer.from('hello-proof').toString('base64'));
assert.equal(Buffer.from(roundTrip).toString('utf8'), 'hello-proof');

console.log('upload-proof: ok');

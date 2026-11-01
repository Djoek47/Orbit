/**
 * Sidekick / shared-device proof payload — must never leave admins with a local URI.
 * Run: npx tsx lib/sidekick/proof-submit-body.test.ts
 */
import assert from 'node:assert/strict';

import { buildSidekickProofSubmitBody } from '@/lib/sidekick/proof-submit-body';

const base = { code: 'CMX-MAYA', taskId: 'task-1' };

{
  const body = buildSidekickProofSubmitBody({
    ...base,
    proofBase64: Buffer.from('tiny-proof-bytes').toString('base64'),
    proofMime: 'image/jpeg',
    proofExt: 'jpg',
  });
  assert.equal(body.action, 'submit_proof');
  assert.ok(typeof body.proofBase64 === 'string' && body.proofBase64.length > 8);
  assert.equal(body.proofUri, undefined);
}

{
  const remote = 'https://x.supabase.co/storage/v1/object/public/task-proofs/h/t/1.jpg';
  const body = buildSidekickProofSubmitBody({
    ...base,
    remoteUri: remote,
    proofBase64: Buffer.from('tiny-proof-bytes').toString('base64'),
  });
  assert.equal(body.proofUri, remote);
  assert.ok(body.proofBase64, 'still send bytes when they fit — PUT can lie');
}

{
  const remote = 'https://x.supabase.co/storage/v1/object/public/task-proofs/h/t/2.jpg';
  const huge = 'a'.repeat(4_500_001);
  const body = buildSidekickProofSubmitBody({
    ...base,
    remoteUri: remote,
    proofBase64: huge,
  });
  assert.equal(body.proofUri, remote);
  assert.equal(body.proofBase64, undefined, 'drop oversized base64 when https exists');
}

{
  assert.throws(
    () =>
      buildSidekickProofSubmitBody({
        ...base,
        proofBase64: 'a'.repeat(4_500_001),
      }),
    /too large/i
  );
}

{
  assert.throws(
    () => buildSidekickProofSubmitBody({ ...base }),
    /prepare the photo/i
  );
}

{
  // Local file:// must never be treated as durable.
  const body = buildSidekickProofSubmitBody({
    ...base,
    remoteUri: 'file:///var/mobile/proof.jpg',
    proofBase64: Buffer.from('tiny-proof-bytes').toString('base64'),
  });
  assert.equal(body.proofUri, undefined);
  assert.ok(body.proofBase64);
}

console.log('proof-submit-body: ok');

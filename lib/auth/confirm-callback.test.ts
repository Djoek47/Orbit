/**
 * Confirm-callback remount: verify must still finish after the effect re-runs.
 * Run: npx --yes tsx lib/auth/confirm-callback.test.ts
 */

import assert from 'node:assert/strict';

import {
  classifyConfirmError,
  createConfirmController,
  shouldResumeSignedInOnConfirmLink,
  withTimeout,
} from './confirm-callback';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

async function main() {
  {
    const c = createConfirmController();
    const key = 'choremaxx://auth/callback?token_hash=abc&type=signup';
    assert.equal(c.shouldStartVerify(key), true);
    c.markVerifyStarted(key);
    assert.equal(c.shouldStartVerify(key), false);
    assert.equal(c.canEscape(), true, 'wall clock still allowed while verify is in flight');
    c.markFinished();
    assert.equal(c.canEscape(), false);
    assert.equal(c.shouldStartVerify(key), false);
    pass('remount does not restart verify; wall clock blocked only after finish');
  }

  {
    let started = 0;
    let discarded = 0;
    let kept = 0;
    const c = createConfirmController();
    const key = 'choremaxx://auth/callback?token_hash=xyz&type=signup';

    const run = () => {
      if (!c.shouldStartVerify(key)) return;
      c.markVerifyStarted(key);
      started += 1;
    };

    run();
    run(); // remount with same payload
    assert.equal(started, 1);

    // Verify resolves after remount — must not be discarded.
    if (c.finished) {
      discarded += 1;
    } else {
      c.markFinished();
      kept += 1;
    }
    assert.equal(discarded, 0);
    assert.equal(kept, 1);
    pass('in-flight success is kept across remount');
  }

  {
    const timed = classifyConfirmError(
      new Error('Confirmation timed out. Enter the code from your email instead.')
    );
    assert.equal(timed.phase, 'needs_continue');
    const expired = classifyConfirmError(new Error('Token has expired or is invalid'));
    assert.equal(expired.phase, 'needs_continue');
    const dump = classifyConfirmError(
      new Error(
        JSON.stringify({ ok: false, status: 500, url: 'https://x.supabase.co/auth/v1/verify' })
      )
    );
    assert.equal(dump.phase, 'error');
    assert.equal(dump.message.includes('supabase'), false);
    assert.equal(dump.message.includes('{'), false);
    pass('classifyConfirmError hides provider dumps');
  }

  {
    assert.equal(shouldResumeSignedInOnConfirmLink(true), true);
    assert.equal(shouldResumeSignedInOnConfirmLink(false), false);
    pass('used inbox link resumes the signed-in app instead of Enter code');
  }

  {
    await assert.rejects(
      () => withTimeout(new Promise(() => undefined), 30, 'Confirmation timed out.'),
      /timed out/
    );
    const value = await withTimeout(Promise.resolve(7), 200, 'nope');
    assert.equal(value, 7);
    pass('withTimeout rejects hung work and returns fast success');
  }

  console.log('\nconfirm-callback tests passed');
}

void main();

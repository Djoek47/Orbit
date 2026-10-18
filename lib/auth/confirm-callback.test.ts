/**
 * Confirm-callback remount: verify must still finish after the effect re-runs.
 * Run: npx --yes tsx lib/auth/confirm-callback.test.ts
 */

import assert from 'node:assert/strict';

import {
  OTP_CODE_TYPES,
  classifyConfirmError,
  confirmCheckMessage,
  createConfirmController,
  createSingleFlight,
  isTokenMismatchError,
  isUsedOrExpiredLinkError,
  isUserEmailConfirmed,
  normalizeOtpCode,
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

  {
    assert.deepEqual(normalizeOtpCode('5440 9146'), { code: '54409146', valid: true });
    assert.equal(normalizeOtpCode('123456').valid, true);
    assert.equal(normalizeOtpCode('12345').valid, false);
    assert.equal(normalizeOtpCode('1234567890').valid, true);
    assert.equal(normalizeOtpCode('12345678901').code.length, 10);
    pass('OTP codes accept 6–10 digits (8-digit project setting)');
  }

  {
    assert.deepEqual([...OTP_CODE_TYPES], ['signup', 'email']);
    assert.equal(isTokenMismatchError({ code: 'otp_expired', message: 'Token has expired or is invalid' }), true);
    assert.equal(isTokenMismatchError({ message: 'For security purposes, you can only request this after 30 seconds' }), false);
    assert.equal(isUsedOrExpiredLinkError({ code: 'otp_expired' }), true);
    assert.equal(isUsedOrExpiredLinkError(new Error('Email link is invalid or has expired')), true);
    assert.equal(isUsedOrExpiredLinkError(new Error('invalid flow state, no valid flow state found')), true);
    assert.equal(isUsedOrExpiredLinkError(new Error('Network request failed')), false);
    pass('used/expired link and token-mismatch detection');
  }

  {
    assert.equal(isUserEmailConfirmed({ email_confirmed_at: '2026-10-13T00:00:00Z' }), true);
    assert.equal(isUserEmailConfirmed({ confirmed_at: '2026-10-13T00:00:00Z' }), true);
    assert.equal(isUserEmailConfirmed({ email_confirmed_at: null }), false);
    assert.equal(isUserEmailConfirmed(null), false);
    assert.match(confirmCheckMessage('confirmed'), /already confirmed, continuing/);
    assert.match(confirmCheckMessage('not_confirmed'), /Not confirmed yet/);
    pass('confirmed-user detection and check copy');
  }

  {
    const flight = createSingleFlight<number>();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const a = flight.run(async () => {
      calls += 1;
      await gate;
      return 1;
    });
    const b = flight.run(async () => {
      calls += 1;
      return 2;
    });
    assert.equal(flight.busy, true);
    release();
    assert.deepEqual(await Promise.all([a, b]), [1, 1]);
    assert.equal(calls, 1);
    assert.equal(flight.busy, false, 'busy clears after finish');
    await assert.rejects(() => flight.run(async () => { throw new Error('x'); }));
    assert.equal(flight.busy, false, 'busy clears after failure');
    pass('single-flight check: concurrent taps join, never stuck busy');
  }

  console.log('\nconfirm-callback tests passed');
}

void main();

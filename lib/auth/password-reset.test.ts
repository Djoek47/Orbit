import assert from 'node:assert/strict';

import {
  callbackDestination,
  checkNewPassword,
  clearMockAuthInbox,
  isCompleteResetCode,
  latestMockResetEmail,
  markResetEmailSent,
  mockCodeMatches,
  mockResetCodeFor,
  normalizeResetCode,
  resendLabel,
  resetCooldownForTests,
  resetResendRemainingMs,
  sendMockResetEmail,
} from '@/lib/auth/password-reset';

// A recovery link goes to the new-password screen, not into the app.
assert.equal(callbackDestination('recovery'), 'recovery');
assert.equal(callbackDestination('RECOVERY'), 'recovery');
assert.equal(callbackDestination('signup'), 'default');
assert.equal(callbackDestination(undefined), 'default');

// New password rules.
assert.equal(checkNewPassword('', '').ok, false);
assert.equal(checkNewPassword('short', 'short').ok, false);
assert.deepEqual(checkNewPassword('longenough', 'longenoug').ok, false);
assert.equal(checkNewPassword('longenough', 'longenough').ok, true);
const short = checkNewPassword('abc', 'abc');
assert.equal(short.ok, false);
assert.match(short.ok ? '' : short.message, /8 characters/);

// Codes are typed all sorts of ways.
assert.equal(normalizeResetCode('123 456'), '123456');
assert.equal(normalizeResetCode('12-34-56'), '123456');
assert.equal(normalizeResetCode('1234567'), '123456');
assert.equal(isCompleteResetCode('123 45'), false);
assert.equal(isCompleteResetCode('123456'), true);

// Mock inbox: a reset email exists, carries a 6-digit code and a recovery link.
clearMockAuthInbox();
const mail = sendMockResetEmail('Sarah@Example.com ', 1000);
assert.equal(mail.to, 'Sarah@Example.com');
assert.equal(mail.subject, 'Reset your password');
assert.match(mail.code, /^\d{6}$/);
assert.ok(mail.link.includes('type=recovery'));
assert.equal(latestMockResetEmail('sarah@example.com')?.code, mail.code);
assert.equal(latestMockResetEmail('someone@else.com'), null);

// The same address always gets the same code, and only that code opens the screen.
assert.equal(mockResetCodeFor('sarah@example.com'), mockResetCodeFor('  SARAH@example.com '));
assert.equal(mockCodeMatches('sarah@example.com', mail.code), true);
assert.equal(mockCodeMatches('sarah@example.com', '000000'), mail.code === '000000');

// Resend is held back for a minute, and the button says how long.
resetCooldownForTests();
assert.equal(resetResendRemainingMs(5_000), 0);
assert.equal(resendLabel(5_000), 'Resend');
markResetEmailSent(5_000);
assert.equal(resetResendRemainingMs(5_000), 60_000);
assert.equal(resendLabel(35_000), 'Resend in 30s');
assert.equal(resetResendRemainingMs(70_000), 0);
assert.equal(resendLabel(70_000), 'Resend');
resetCooldownForTests();

console.log('password-reset: ok');

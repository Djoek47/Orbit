import assert from 'node:assert/strict';
import test from 'node:test';

import { renderAuthHookEmail } from './auth-hook-render';

test('auth hook maps signup → verification template', async () => {
  const out = await renderAuthHookEmail({
    action: 'signup',
    name: 'Sarah',
    confirmUrl: 'https://example.com/verify',
    otp: '123456',
  });
  assert.match(out.subject, /Confirm your email|Verify your ChoreMaxx account/i);
  assert.match(out.html, /Confirm email|Verify Email/);
  assert.match(out.html, /choremaxx-email-logo-mark|choremaxx-mark-coral/);
  assert.match(out.html, /Bricolage/);
  assert.match(out.html, /123456/);
  assert.match(out.text, /123456/);
});

test('auth hook maps recovery → password reset', async () => {
  const out = await renderAuthHookEmail({
    action: 'recovery',
    name: 'Sarah',
    confirmUrl: 'https://example.com/reset',
  });
  assert.match(out.subject, /Reset your password/i);
  assert.match(out.html, /Reset Password/);
});

test('auth hook maps magiclink → magic link', async () => {
  const out = await renderAuthHookEmail({
    action: 'magiclink',
    name: 'Sarah',
    confirmUrl: 'https://example.com/magic',
  });
  assert.match(out.subject, /sign-in link/i);
  assert.match(out.html, /Sign In/);
});

test('auth hook maps email_change with confirm CTA', async () => {
  const out = await renderAuthHookEmail({
    action: 'email_change',
    name: 'Sarah',
    confirmUrl: 'https://example.com/confirm-email',
    oldEmail: 'old@example.com',
    newEmail: 'new@example.com',
  });
  assert.match(out.subject, /Confirm your new ChoreMaxx email|email address changed/i);
  assert.match(out.html, /Confirm new email|confirm-email/i);
});

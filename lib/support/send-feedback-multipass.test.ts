/**
 * Multipass: Support Send must deliver + show an in-screen confirmation
 * (never nest orbitAlert over the Support modal).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('Pass A — client requires session before invoke', () => {
  const src = readFileSync(join(root, 'lib/support/send-feedback.ts'), 'utf8');
  assert.match(src, /getSession/);
  assert.match(src, /Sign in with Apple or email/);
  assert.match(src, /edgeErrorMessage/);
  assert.match(src, /ackEmailed/);
  assert.match(src, /ticketRef/);
  // Empty / non-success bodies must not fake a send.
  assert.match(src, /payload\.ok !== true/);
});

test('Pass B — edge returns ticket + ackEmailed after Resend inbox', () => {
  const edge = readFileSync(
    join(root, 'supabase/functions/send-support-feedback/index.ts'),
    'utf8'
  );
  assert.match(edge, /api\.resend\.com\/emails/);
  assert.match(edge, /ackEmailed = true/);
  assert.match(edge, /ticketRef: ref/);
  assert.match(edge, /ackEmailed/);
  assert.match(edge, /Support email is not configured/);
});

test('Pass C — Support screen shows in-screen receipt (not nested orbitAlert)', () => {
  const support = readFileSync(join(root, 'app/support.tsx'), 'utf8');
  assert.match(support, /Feedback sent/);
  assert.match(support, /setSent\(/);
  assert.match(support, /SentReceipt/);
  assert.match(support, /Alert\.alert\('Could not send'/);
  assert.match(support, /Email instead/);
  assert.match(support, /scrollTo\(\{ y: 0/);
  // Success must not use orbitAlert (vanishes under presentation:modal).
  assert.doesNotMatch(
    support,
    /orbitAlert\(\s*['"]Sent['"]/
  );
  assert.match(support, /We emailed you a confirmation|Our team got your report/);
});

test('Pass D — selected errors + screenshots still wired', () => {
  const support = readFileSync(join(root, 'app/support.tsx'), 'utf8');
  const client = readFileSync(join(root, 'lib/support/send-feedback.ts'), 'utf8');
  assert.match(support, /selectedErrorIds/);
  assert.match(support, /pickSupportScreenshot/);
  assert.match(client, /selectedErrorIds/);
  assert.match(client, /screenshotUrls/);
  assert.match(client, /attachments/);
});

/**
 * Run: npx --yes tsx --test lib/errors/friendly-error.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { friendlyErrorMessage, looksLikeErrorAlert } from './friendly-error';

test('maps proof_uri_required to a human sentence', () => {
  assert.match(friendlyErrorMessage('proof_uri_required'), /photo/i);
});

test('maps Edge Function non-2xx to a connection sentence', () => {
  assert.match(
    friendlyErrorMessage('Edge Function returned a non-2xx status code'),
    /reach|connection/i
  );
});

test('keeps short human messages', () => {
  assert.equal(
    friendlyErrorMessage('This task may already be done.'),
    'This task may already be done.'
  );
});

test('detects error-like alert titles', () => {
  assert.equal(looksLikeErrorAlert('Could not send proof', 'proof_uri_required'), true);
  assert.equal(looksLikeErrorAlert('Reminder sent', 'Emma was notified.'), false);
});

test('sku_not_found credit pack copy steers to another size or feedback', () => {
  const msg = friendlyErrorMessage(
    'sku_not_found: app.choremaxx.household.premium.tokens.medium is not available from App Store Connect for this build.'
  );
  assert.match(msg, /not for sale|another size|App Store Connect/i);
  assert.doesNotMatch(msg, /sku_not_found/);
  assert.doesNotMatch(msg, /tokens\.medium/);
});

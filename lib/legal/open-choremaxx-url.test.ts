/**
 * Privacy / Terms must open www.choremaxx.app in the system browser.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';

const root = process.cwd();

test('defaults point at choremaxx.app privacy and terms', () => {
  assert.equal(CHOREMAXX_LEGAL.privacyUrl, 'https://www.choremaxx.app/privacy');
  assert.equal(CHOREMAXX_LEGAL.termsUrl, 'https://www.choremaxx.app/terms');
  assert.doesNotMatch(CHOREMAXX_LEGAL.privacyUrl, /vercel\.app/);
  assert.doesNotMatch(CHOREMAXX_LEGAL.termsUrl, /vercel\.app/);
});

test('openChoremaxxUrl prefers Linking.openURL for https', () => {
  const src = readFileSync(join(root, 'lib/legal/open-choremaxx-url.ts'), 'utf8');
  assert.match(src, /Linking\.openURL/);
  // System browser before in-app WebBrowser (ignore import line).
  const body = src.slice(src.indexOf('export async function openChoremaxxUrl'));
  const linkIdx = body.indexOf('await Linking.openURL(trimmed)');
  const webIdx = body.indexOf('await openBrowserAsync');
  assert.ok(linkIdx >= 0 && webIdx > linkIdx, 'Linking.openURL must run before openBrowserAsync');
});

test('legal sheet waits for dismiss before opening browser', () => {
  const host = readFileSync(
    join(root, 'components/orbit/settings/legal-links-sheet-host.tsx'),
    'utf8'
  );
  assert.match(host, /InteractionManager\.runAfterInteractions/);
  assert.match(host, /LEGAL_SHEET_DISMISS_MS = 700/);
  assert.match(host, /openChoremaxxUrl\(CHOREMAXX_LEGAL\.privacyUrl/);
  assert.match(host, /openChoremaxxUrl\(CHOREMAXX_LEGAL\.termsUrl/);
});

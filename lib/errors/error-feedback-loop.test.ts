import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

test('orbitAlert offers Send feedback on bare error alerts', () => {
  const src = read('components/orbit/orbit-alert.tsx');
  assert.match(src, /Send feedback/);
  assert.match(src, /errorId/);
  assert.match(src, /\/support\?errorId=/);
});

test('support deep-links a focused error', () => {
  const src = read('app/support.tsx');
  assert.match(src, /errorId/);
  assert.match(src, /focusErrorId/);
  assert.match(src, /useLocalSearchParams/);
});

test('showAppError helper records then opens Support', () => {
  const src = read('lib/errors/show-app-error.ts');
  assert.match(src, /recordAppError/);
  assert.match(src, /Send feedback/);
  assert.match(src, /record:\s*false/);
});

test('showNativeAppError stays available for Settings modals without RN Modal', () => {
  const src = read('lib/errors/show-native-app-error.ts');
  assert.match(src, /recordAppError/);
  assert.match(src, /Send feedback/);
  assert.match(src, /Alert\.alert/);
  assert.match(src, /friendlyErrorMessage/);
  assert.match(src, /formatUnknownError/);
});

test('Credits purchase errors use soft PaywallMessage + Support tap (no nested alert)', () => {
  const credits = read('app/poppins-credits.tsx');
  assert.match(credits, /showBuyError/);
  assert.match(credits, /PaywallMessage/);
  assert.match(credits, /recordAppError/);
  assert.match(credits, /Tap to tell us/);
  assert.match(credits, /\/support/);
  assert.doesNotMatch(credits, /showNativeAppError/);
  assert.doesNotMatch(credits, /orbitAlert\s*\(/);
});

test('formatUnknownError never returns [object Object]', async () => {
  const { formatUnknownError } = await import('@/lib/errors/unknown-error');
  assert.equal(formatUnknownError({ message: 'Failed to request purchase' }), 'Failed to request purchase');
  assert.notEqual(formatUnknownError({ code: 'E_UNKNOWN', debugMessage: 'x' }), '[object Object]');
  assert.equal(formatUnknownError({}), 'Something went wrong');
});

test('error loop plan is documented', () => {
  const src = read('docs/error-feedback-loop.md');
  assert.match(src, /showAppError/);
  assert.match(src, /showNativeAppError/);
  assert.match(src, /Send feedback/);
  assert.match(src, /recordAppError/);
});

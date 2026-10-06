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

test('error loop plan is documented', () => {
  const src = read('docs/error-feedback-loop.md');
  assert.match(src, /showAppError/);
  assert.match(src, /Send feedback/);
  assert.match(src, /recordAppError/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ERROR_CATEGORY_LABEL, inferErrorCategory } from '@/lib/errors/error-category';

test('infers tasks, rewards, poppins, billing, network', () => {
  assert.equal(inferErrorCategory({ message: 'Could not complete this task' }), 'tasks');
  assert.equal(inferErrorCategory({ title: 'Reward failed', message: 'xp claim' }), 'rewards');
  assert.equal(inferErrorCategory({ message: 'Poppins voice session ended' }), 'poppins');
  assert.equal(inferErrorCategory({ message: 'Could not buy credits' }), 'billing');
  assert.equal(inferErrorCategory({ message: 'Network request failed' }), 'network');
  assert.equal(inferErrorCategory({ message: 'something odd' }), 'unknown');
});

test('every category has a label', () => {
  for (const key of Object.keys(ERROR_CATEGORY_LABEL)) {
    assert.ok(ERROR_CATEGORY_LABEL[key as keyof typeof ERROR_CATEGORY_LABEL].length > 0);
  }
});

test('support screen selects errors and screenshots', () => {
  const support = readFileSync(join(process.cwd(), 'app/support.tsx'), 'utf8');
  assert.match(support, /selectedErrorIds/);
  assert.match(support, /pickSupportScreenshot/);
  assert.match(support, /accessibilityRole="checkbox"/);
  assert.match(support, /ERROR_CATEGORY_LABEL/);
});

test('send-feedback forwards selected ids and attachments', () => {
  const src = readFileSync(join(process.cwd(), 'lib/support/send-feedback.ts'), 'utf8');
  assert.match(src, /selectedErrorIds/);
  assert.match(src, /screenshotUrls/);
  assert.match(src, /attachments/);
  assert.match(src, /openTaskCount/);
});

test('edge support function sends user ack', () => {
  const edge = readFileSync(
    join(process.cwd(), 'supabase/functions/send-support-feedback/index.ts'),
    'utf8'
  );
  assert.match(edge, /renderSupportAckEmail/);
  assert.match(edge, /ticketRef/);
  assert.match(edge, /attachments/);
});

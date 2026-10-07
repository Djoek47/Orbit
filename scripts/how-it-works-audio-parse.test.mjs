/**
 * Bake-script parse must read DEMO_BEATS ids (task-ask), not DEMO_CHAPTERS (task).
 * Run: node scripts/how-it-works-audio-parse.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'lib/poppins/how-it-works-script.ts'), 'utf8');

const start = src.indexOf('export const DEMO_BEATS');
assert.ok(start >= 0, 'DEMO_BEATS export');
const end = src.indexOf('export function', start);
const slice = end > start ? src.slice(start, end) : src.slice(start);

const re =
  /\{\s*id:\s*'([^']+)'[\s\S]*?speaker:\s*(null|'rose'|'indigo')[\s\S]*?line:\s*'((?:\\'|[^'])*)'/g;
const ids = [];
let match;
while ((match = re.exec(slice))) {
  if (match[2] === 'null') continue;
  ids.push(match[1]);
}

assert.ok(ids.includes('task-ask'), `expected task-ask, got ${ids.slice(0, 5).join(',')}`);
assert.ok(!ids.includes('task'), 'chapter id "task" must not leak into spoken beats');
assert.ok(ids.length >= 8, `expected ≥8 spoken beats, got ${ids.length}`);

console.log('how-it-works-audio-parse: ok');

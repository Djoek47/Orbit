/**
 * House Rules must navigate inside one sheet — never stack a second House Rules modal.
 * Run: npx --yes tsx lib/rules/house-rules-nav.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../app/house-rules.tsx'),
  'utf8'
);

assert.match(src, /router\.setParams\(\{ chapter: id \}\)/, 'chapter tiles update params');
assert.match(
  src,
  /router\.setParams\(\{ chapter: g\.chapter\.id \?\? g\.chapter\.key \}\)/,
  'chapter prev/next update params'
);
assert.match(src, /router\.setParams\(\{ chapter: '' \}\)/, 'back clears chapter on same sheet');
assert.equal(
  /router\.push\(`\/house-rules\?chapter=/.test(src),
  false,
  'must not push a second House Rules sheet for a chapter'
);
assert.equal(
  /router\.replace\(`\/house-rules\?chapter=/.test(src),
  false,
  'must not replace-stack chapter routes either'
);
assert.match(src, /router\.push\(route as never\)/, 'Change pushes the editor once');
assert.equal(
  src.includes("if (route.startsWith('/settings'))"),
  false,
  'no special-case replace that left House Rules under Settings'
);

const settings = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../app/settings.tsx'),
  'utf8'
);
assert.match(
  settings,
  /router\.navigate\('\/house-rules' as never\)/,
  'Settings reuses House Rules instead of stacking replace'
);

console.log('house-rules-nav: ok');

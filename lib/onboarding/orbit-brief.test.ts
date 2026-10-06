/**
 * Run: npx --yes tsx lib/onboarding/orbit-brief.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const brief = readFileSync(join(root, 'components/orbit/onboarding/orbit-brief.tsx'), 'utf8');

assert.match(brief, /Chores into XP/);
assert.match(brief, /Three beats/);
assert.match(brief, /Moji/);
assert.match(brief, /LinearGradient/);
assert.match(brief, /PILLARS/);
assert.match(brief, /One home/);
assert.match(brief, /Poppins/);
assert.match(brief, /Your XP/);
assert.doesNotMatch(
  brief,
  /operating system for your household/,
  'long lede copy must stay gone'
);
assert.doesNotMatch(
  brief,
  /Turn Chores into XP\. Run Your Household/,
  'old long headline must stay gone'
);
assert.doesNotMatch(brief, /without hunting through menus/);
assert.match(brief, /ZoomIn|FadeInDown|withRepeat/);

console.log('orbit-brief: ok');

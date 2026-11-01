/**
 * Run: npx --yes tsx lib/onboarding/orbit-brief.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const brief = readFileSync(join(root, 'components/orbit/onboarding/orbit-brief.tsx'), 'utf8');

assert.match(brief, /Turn chores into XP/);
assert.match(brief, /Run your household like never before/);
assert.match(brief, /body: /, 'each pillar carries one explanatory line');
assert.doesNotMatch(brief, /Three beats/, 'vague lede must stay gone');
assert.match(brief, /Moji/);
assert.match(brief, /LinearGradient/);
assert.match(brief, /PILLARS/);
assert.match(brief, /One Home\. One App\./);
assert.match(brief, /every household aspect is covered/);
assert.match(brief, /Speak your wishes into existence with Poppins AI\./);
assert.match(brief, /Household Management\./);
assert.match(brief, /Turn chores into XP\. And XP into rewards\./);
assert.doesNotMatch(brief, /changed later in Settings/, 'settings footnote must stay gone');
assert.doesNotMatch(brief, /Say or type it/, 'old Poppins description must stay gone');
assert.doesNotMatch(brief, /Shared picture|Everyone in sync/, 'pillar hints must stay gone');
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
assert.match(brief, /FadeInDown|withRepeat/);
assert.match(brief, /BrandLegalFooter/, 'Privacy · Terms · Support under Continue');
assert.match(brief, /OrbitButton onPress=\{onContinue\}/);

console.log('orbit-brief: ok');

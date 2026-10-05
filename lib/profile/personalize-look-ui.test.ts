/**
 * Make-your-character sheet — premium UI + cloud-save copy contracts.
 * Run: npx --yes tsx --test lib/profile/personalize-look-ui.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('personalize look sheet uses premium Orbit primitives', () => {
  const sheet = readFileSync(
    join(process.cwd(), 'components/orbit/personalize-look-sheet.tsx'),
    'utf8'
  );
  assert.match(sheet, /OrbitButton/);
  assert.match(sheet, /SegmentedControl/);
  assert.match(sheet, /StatusPill/);
  assert.match(sheet, /LinearGradient/);
  assert.match(sheet, /FadeInDown/);
  assert.match(sheet, /Avatar/);
  assert.match(sheet, /cloud-done|Saved with your household|household vault/);
  assert.match(sheet, /Saving to your household/);
  assert.match(sheet, /isShareableAvatarUri/);
  assert.doesNotMatch(sheet, /Create with Image Playground[\s\S]{0,40}styles\.cta/);
});

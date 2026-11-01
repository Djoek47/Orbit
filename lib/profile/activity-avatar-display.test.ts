/**
 * Activity streak chips must render Playground photos via Avatar — never as "file://" text.
 * Run: npx --yes tsx lib/profile/activity-avatar-display.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const strip = read('components/orbit/streak-strip.tsx');
assert.match(strip, /components\/orbit\/avatar/);
assert.match(strip, /isAvatarImageUri\(row\.avatar\)/);
assert.match(strip, /imageUri=\{isAvatarImageUri/);
assert.doesNotMatch(
  strip,
  />\{row\.avatar\}</,
  'never dump avatar URI into Text (shows file://)'
);

const avatar = read('components/orbit/avatar.tsx');
assert.match(avatar, /onError/);
assert.match(avatar, /photoFailed/);

assert.equal(isAvatarImageUri('file://'), false, 'bare scheme is not a photo');
assert.equal(isAvatarImageUri('file:///'), false);
assert.equal(isAvatarImageUri('file:///var/mobile/Containers/Data/avatar.png'), true);
assert.equal(isAvatarImageUri('👩'), false);
assert.ok(
  memberDisplayEmoji({ name: 'Nero', avatar: 'file:///tmp/a.png' }).length > 0,
  'image URI falls back to emoji glyph for Avatar emoji prop'
);

const store = read('store/orbit-store.tsx');
assert.match(
  store,
  /rememberAvatarInLibrary/,
  'saving a face also banks it in the You gallery'
);

console.log('activity-avatar-display: ok');

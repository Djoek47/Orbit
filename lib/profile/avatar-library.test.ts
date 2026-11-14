/**
 * Run: npx --yes tsx lib/profile/avatar-library.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clearAvatarLibraryForTests,
  listAvatarLibrary,
  rememberAvatarInLibrary,
} from '@/lib/profile/avatar-library';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

async function main() {
  const userId = 'test-user-avatar-lib';
  await clearAvatarLibraryForTests(userId);

  const empty = await listAvatarLibrary(userId);
  assert.deepEqual(empty, []);

  const after = await rememberAvatarInLibrary({
    userId,
    uri: 'file:///avatars/dragon.png',
    source: 'playground',
  });
  assert.equal(after.length, 1);
  assert.equal(after[0]?.source, 'playground');

  await rememberAvatarInLibrary({
    userId,
    uri: 'file:///avatars/dragon.png',
    source: 'playground',
  });
  const listed = await listAvatarLibrary(userId);
  assert.equal(listed.length, 1, 'same URI does not duplicate');

  await rememberAvatarInLibrary({
    userId,
    uri: 'file:///avatars/fox.png',
    source: 'photos',
  });
  assert.equal((await listAvatarLibrary(userId)).length, 2);

  const settings = read('app/settings.tsx');
  assert.match(settings, /AvatarLibraryStrip|listAvatarLibrary|Your gallery/);
  assert.match(settings, /Transfer ownership/);
  assert.doesNotMatch(
    settings,
    /subtitle="Transfer ownership · delete"/,
    'House hub row must stay off main Settings'
  );
  assert.match(settings, /section === 'you'/);
  // Danger zone lives under You, not a top-level House section on main.
  assert.doesNotMatch(
    settings.split('{section === \'main\'')[1]?.split('{section === \'you\'')[0] ?? '',
    /Transfer ownership/
  );

  const sheet = read('components/orbit/personalize-look-sheet.tsx');
  assert.match(sheet, /rememberAvatarInLibrary|Your gallery/);

  const send = read('lib/household/send-household-transfer.ts');
  assert.match(send, /edgeErrorMessage|friendlyTransferError/);

  console.log('avatar-library: ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

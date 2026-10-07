/**
 * Run: npx --yes tsx lib/streaks/streak-lost-ack.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  acknowledgeStreakLost,
  clearStreakLostAcks,
  hasAcknowledgedStreakLost,
  resetStreakLostAcksForTests,
} from '@/lib/streaks/streak-lost-ack';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

async function main() {
  await resetStreakLostAcksForTests();

  assert.equal(await hasAcknowledgedStreakLost('m-jack', '2026-10-05'), false);
  await acknowledgeStreakLost('m-jack', '2026-10-05');
  assert.equal(await hasAcknowledgedStreakLost('m-jack', '2026-10-05'), true);
  assert.equal(
    await hasAcknowledgedStreakLost('m-emma', '2026-10-05'),
    false,
    'acks are per member'
  );
  assert.equal(
    await hasAcknowledgedStreakLost('m-jack', '2026-10-06'),
    false,
    'new cliff can show again'
  );

  await clearStreakLostAcks();
  assert.equal(
    await hasAcknowledgedStreakLost('m-jack', '2026-10-05'),
    false,
    'full sign-out clears acks'
  );

  const home = read('app/(tabs)/index.tsx');
  assert.match(home, /acknowledgeStreakLost|hasAcknowledgedStreakLost/);
  assert.match(home, /streakEndedAt/);

  const sheet = read('components/orbit/streak-lost-sheet.tsx');
  assert.match(sheet, /Moji|fire|ChapterHero|LinearGradient/);
  assert.doesNotMatch(sheet, /Rescue wasn’t available this time/);

  const signOut = read('lib/auth/local-sign-out.ts');
  assert.match(signOut, /clearStreakLostAcks/);

  console.log('streak-lost-ack: ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

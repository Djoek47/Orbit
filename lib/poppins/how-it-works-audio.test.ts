/**
 * Every spoken How-it-works beat must have a baked GPT conversational clip.
 * (Reads source + disk — does not import RECORDINGS, which require() binary m4a.)
 * Run: npx --yes tsx lib/poppins/how-it-works-audio.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEMO_BEATS } from './how-it-works-script';

const spokenIds = DEMO_BEATS.filter((b) => b.speaker && b.line.trim()).map((b) => b.id);
const audioSrc = readFileSync(join(process.cwd(), 'lib/poppins/how-it-works-audio.ts'), 'utf8');

assert.match(audioSrc, /const RECORDINGS/);
assert.match(audioSrc, /Do not fall back to device Speech/);
assert.equal(audioSrc.includes('expo-speech'), false);

const wired = [...audioSrc.matchAll(/'([^']+)':\s*require\(/g)].map((m) => m[1]!);
assert.ok(wired.length > 0, 'RECORDINGS must be wired (run how-it-works bake)');
assert.deepEqual(
  spokenIds.filter((id) => !wired.includes(id)),
  [],
  `missing from RECORDINGS: ${spokenIds.filter((id) => !wired.includes(id)).join(', ')}`
);

for (const id of spokenIds) {
  assert.ok(
    existsSync(join(process.cwd(), 'assets/how-it-works', `${id}.m4a`)),
    `${id}.m4a on disk`
  );
}

console.log(`how-it-works-audio: ok (${spokenIds.length} clips)`);

/**
 * ChoreMaxx speaks English. A French-region phone heard English as French, and Poppins wrote
 * back French titles ("Une TâChe Pour Moi", "Bonjour Poppins est-ce que tu peux…").
 *
 * Run: npx tsx lib/poppins/english-only.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseEventUtterance } from '@/lib/poppins/event-parse';
import { listenLocale } from '@/lib/voice/base-listener';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// The recogniser listens in English whatever the phone is set to.
for (const locale of ['fr-CA', 'fr_FR', 'de-DE', 'it-IT', 'es-ES', '']) {
  assert.match(listenLocale(locale), /^en-/, `${locale || 'empty'} listens in English`);
}
assert.equal(listenLocale('en-GB'), 'en-GB', 'an English region is kept');

// Every server prompt carries the rule, through the one builder they all use.
const profiles = read('supabase/functions/_shared/majordomo-profiles.ts');
assert.match(profiles, /ENGLISH_ONLY_RULE/);
assert.match(profiles, /always speak and write in English/i);
assert.match(
  profiles,
  /\$\{SPOKEN_WORDS_RULE\}\$\{ENGLISH_ONLY_RULE\}/,
  'the rule is part of the shared system prompt'
);
// And the live voice session transcribes as English rather than guessing.
assert.match(
  read('supabase/functions/_shared/poppins-realtime-session-config.ts'),
  /language: 'en'/
);
// Cloud STT for Base hybrid also pins English (Apple-first → Whisper / mini-transcribe).
assert.match(read('supabase/functions/poppins-voice/index.ts'), /append\('language', 'en'\)/);
assert.match(
  read('supabase/functions/poppins-voice/index.ts'),
  /getOpenAIInputTranscribeModel/
);

// The spoken wrapper never becomes the title — in either language.
for (const said of [
  'Bonjour Poppins est-ce que tu peux rajouter sur le calendrier un rendez-vous chez le dentiste jeudi prochain',
  'Hey Poppins can you add a dentist appointment on Thursday',
  'Poppins, put a dentist appointment on the calendar Thursday',
]) {
  const title = parseEventUtterance(said).title;
  assert.ok(!/poppins/i.test(title), `no assistant name in "${title}"`);
  assert.ok(!/est-ce que|peux-tu/i.test(title), `no French wrapper in "${title}"`);
  assert.ok(title.length <= 60, `a title, not a sentence: "${title}"`);
  assert.match(title, /dentist/i, `the thing itself survives: "${title}"`);
}

// How it works plays baked GPT conversational audio — never device Speech.
const audio = read('lib/poppins/how-it-works-audio.ts');
assert.match(audio, /RECORDINGS/);
assert.match(audio, /Do not fall back to device Speech|Never use device Speech/);
assert.ok(
  [...audio.matchAll(/'([^']+)':\s*require\(/g)].length >= 8,
  'RECORDINGS must include baked clips'
);
const player = read('components/orbit/poppins/how-it-works-player.tsx');
assert.match(player, /recordedDemoAudio\(beat\.id\)/);
assert.match(player, /hasRecordedDemoAudio\(\)/);
assert.equal(player.includes('expo-speech'), false, 'no Apple Speech fallback');
assert.equal(player.includes('Speech.speak'), false, 'no Speech.speak');
assert.match(player, /Never use device Speech|baked GPT conversational/);
assert.match(read('scripts/generate-how-it-works-audio.mjs'), /gpt-4o-mini-tts/);

console.log('english-only: ok');

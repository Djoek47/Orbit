#!/usr/bin/env node
/**
 * Bake one short Poppins line per colour-voice for Settings → How Poppins sounds.
 *
 * Offline forever after commit — no credits at preview time.
 *
 *   OPENAI_API_KEY=sk-... node scripts/generate-voice-previews.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets/voice-previews');
const audioTsPath = join(root, 'lib/ai/voice-preview-audio.ts');

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  console.error('OPENAI_API_KEY is required.');
  process.exit(1);
}

const model = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts';

/** Same order as POPPINS_VOICES — OpenAI Realtime / TTS voice ids. */
const VOICES = [
  { id: 'coral', label: 'Rose' },
  { id: 'shimmer', label: 'Coral' },
  { id: 'sage', label: 'Amber' },
  { id: 'ballad', label: 'Honey' },
  { id: 'alloy', label: 'Sand' },
  { id: 'verse', label: 'Moss' },
  { id: 'marin', label: 'Jade' },
  { id: 'echo', label: 'Slate' },
  { id: 'ash', label: 'Cobalt' },
  { id: 'cedar', label: 'Indigo' },
];

const LINE = 'Ready when you are.';
const INSTRUCTIONS =
  'You are Poppins, a calm household co-manager. Speak clear modern American English, ' +
  'friendly and brief, like ChatGPT Advanced Voice. One short line only — natural, never robotic.';

async function synthesize(voiceId) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice: voiceId,
      input: LINE,
      instructions: INSTRUCTIONS,
      response_format: 'wav',
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${voiceId} ${res.status}: ${detail.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function wavToM4a(wavPath, m4aPath) {
  execFileSync(
    'ffmpeg',
    ['-y', '-i', wavPath, '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-ar', '44100', m4aPath],
    { stdio: 'pipe' }
  );
}

function writeAudioModule(ids) {
  const lines = ids.map((id) => `  ${id}: require('@/assets/voice-previews/${id}.m4a'),`).join('\n');
  writeFileSync(
    audioTsPath,
    `/**
 * Short offline clips for Settings → How Poppins sounds.
 * Baked by scripts/generate-voice-previews.mjs (gpt-4o-mini-tts).
 * Line: "${LINE}"
 */

import type { MajordomoVoiceId } from '@/lib/ai/majordomo-profiles';

const PREVIEWS: Partial<Record<MajordomoVoiceId, number>> = {
${lines}
};

export const VOICE_PREVIEW_LINE = '${LINE}';

export function voicePreviewAudio(voiceId: MajordomoVoiceId): number | null {
  return PREVIEWS[voiceId] ?? null;
}
`
  );
}

async function main() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
  } catch {
    console.error('ffmpeg is required (WAV → m4a).');
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  console.log(`Baking ${VOICES.length} voice previews (${model}): "${LINE}"`);

  const ids = [];
  for (const voice of VOICES) {
    process.stdout.write(`  ${voice.label} (${voice.id})… `);
    const wav = await synthesize(voice.id);
    const wavPath = join(outDir, `${voice.id}.wav`);
    const m4aPath = join(outDir, `${voice.id}.m4a`);
    writeFileSync(wavPath, wav);
    wavToM4a(wavPath, m4aPath);
    if (existsSync(wavPath)) unlinkSync(wavPath);
    ids.push(voice.id);
    console.log('ok');
  }

  writeAudioModule(ids);
  console.log(`Wrote ${audioTsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

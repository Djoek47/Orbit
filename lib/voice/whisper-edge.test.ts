/**
 * Source locks for poppins-voice whisper hardening.
 * Run: npx --yes tsx --test lib/voice/whisper-edge.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('edge tags m4a as audio/mp4 and retries whisper-1 on 400', () => {
  const edge = read('supabase/functions/poppins-voice/index.ts');
  const shared = read('supabase/functions/_shared/whisper-audio.ts');
  assert.match(shared, /audio\/mp4/);
  assert.match(shared, /whisper-1/);
  assert.match(edge, /normalizeVoiceMimeType/);
  assert.match(edge, /shouldRetryWhisperFallback/);
  assert.match(edge, /WHISPER_FALLBACK_MODEL/);
  assert.match(edge, /openaiWhisperErrorDetail/);
  assert.match(edge, /response_format/);
  // Failures must not look like success to the client.
  assert.match(edge, /503/);
  assert.match(edge, /502/);
  assert.doesNotMatch(
    edge,
    /error: 'whisper_failed',\s*\n\s*detail: whisperDetail,\s*\n\s*source: 'whisper',\s*\n\s*\}\);/
  );
});

test('client uploads Quiet audio as audio/mp4', () => {
  const client = read('lib/voice/poppins-voice.ts');
  assert.match(client, /QUIET_AUDIO_MIME/);
  assert.doesNotMatch(client, /mimeType: 'audio\/m4a'/);
  assert.doesNotMatch(client, /type: 'audio\/m4a'/);
});

test('voice failures log as source voice, not crash', () => {
  const failures = read('lib/voice/quiet-failures.ts');
  assert.match(failures, /source: 'voice'/);
  assert.match(failures, /category: 'poppins'/);
  assert.doesNotMatch(failures, /saveLastAppError/);
});

test('voiceResult labels gateway status as edge N', () => {
  const response = read('lib/voice/voice-response.ts');
  assert.match(response, /edge \$\{status\}/);
  assert.doesNotMatch(response, /`http \$\{status\}`/);
});

/**
 * Run: npx --yes tsx --test lib/voice/whisper-audio.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_WHISPER_AUDIO_BYTES,
  normalizeVoiceMimeType,
  openaiWhisperErrorDetail,
  QUIET_AUDIO_MIME,
  shouldRetryWhisperFallback,
  WHISPER_FALLBACK_MODEL,
} from '@/lib/voice/whisper-audio';

test('m4a / aac mime types normalize to audio/mp4 for OpenAI', () => {
  assert.equal(normalizeVoiceMimeType('audio/m4a'), QUIET_AUDIO_MIME);
  assert.equal(normalizeVoiceMimeType('audio/x-m4a'), QUIET_AUDIO_MIME);
  assert.equal(normalizeVoiceMimeType('audio/aac'), QUIET_AUDIO_MIME);
  assert.equal(normalizeVoiceMimeType(undefined), QUIET_AUDIO_MIME);
  assert.equal(normalizeVoiceMimeType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeVoiceMimeType('audio/mp4'), 'audio/mp4');
});

test('openai whisper detail keeps code when present', () => {
  assert.equal(
    openaiWhisperErrorDetail(400, {
      error: { message: 'Audio file might be corrupted or unsupported', code: 'unsupported_format' },
    }),
    'openai_400:unsupported_format'
  );
  assert.match(
    openaiWhisperErrorDetail(400, { error: { message: 'Invalid file format' } }),
    /^openai_400:Invalid file format$/
  );
});

test('retry whisper-1 on 400/415 only', () => {
  assert.equal(shouldRetryWhisperFallback(400), true);
  assert.equal(shouldRetryWhisperFallback(415), true);
  assert.equal(shouldRetryWhisperFallback(401), false);
  assert.equal(shouldRetryWhisperFallback(500), false);
  assert.equal(WHISPER_FALLBACK_MODEL, 'whisper-1');
  assert.ok(MIN_WHISPER_AUDIO_BYTES >= 100);
});

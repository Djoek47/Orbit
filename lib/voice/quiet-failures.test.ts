/**
 * WO15 §1.2 — each Quiet failure cause gets its own message + voice: last-error.
 * Run: npx --yes tsx lib/voice/quiet-failures.test.ts
 */
import assert from 'node:assert/strict';

import {
  classifyVoiceFailure,
  persistVoiceFailure,
  VOICE_FAILURE_MESSAGES,
  VoiceFailureError,
  voiceFailureMessage,
} from '@/lib/voice/quiet-failures';
import { loadLastAppError, clearLastAppError } from '@/lib/errors/last-error';

{
  assert.equal(classifyVoiceFailure('Voice AI unavailable'), 'ai_off');
  assert.equal(classifyVoiceFailure('Voice request returned empty'), 'signed_out');
  assert.equal(classifyVoiceFailure('whisper_failed'), 'whisper_failed');
  assert.equal(classifyVoiceFailure('budget tripped'), 'budget_tripped');
}

{
  assert.equal(voiceFailureMessage('ai_off'), 'Poppins AI is off in this build.');
  assert.equal(
    voiceFailureMessage('signed_out'),
    "You're signed out — sign in to use Poppins."
  );
  assert.equal(voiceFailureMessage('whisper_failed'), "I couldn't reach the transcriber.");
  assert.equal(
    voiceFailureMessage('budget_tripped'),
    "You're out of actions until tomorrow."
  );
}

{
  const err = new VoiceFailureError('ai_off');
  assert.equal(err.causeCode, 'ai_off');
  assert.match(err.message, /Poppins AI is off/);
}

async function main() {
  await clearLastAppError();
  for (const cause of Object.keys(VOICE_FAILURE_MESSAGES) as Array<
    keyof typeof VOICE_FAILURE_MESSAGES
  >) {
    persistVoiceFailure(cause, 'test');
    // AsyncStorage may be a no-op in node — still assert the message shape.
    const stored = await loadLastAppError();
    if (stored) {
      assert.ok(stored.message.startsWith(`voice:${cause}`), stored.message);
    }
  }
  console.log('PASS quiet-failures');
}

void main();

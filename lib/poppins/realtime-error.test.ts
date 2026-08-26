/**
 * Run: npx tsx lib/poppins/realtime-error.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isRecoverableRealtimeError } from './realtime-error';

assert.equal(
  isRecoverableRealtimeError({ code: 'response_cancel_not_active' }),
  true,
  'cancel with nothing to cancel'
);
assert.equal(
  isRecoverableRealtimeError({
    error: {
      code: 'conversation_already_has_active_response',
      message: 'Conversation already has an active response in progress',
    },
  }),
  true,
  'nested already-active'
);
assert.equal(
  isRecoverableRealtimeError('Cancellation failed: no active response found'),
  true
);
assert.equal(isRecoverableRealtimeError({ code: 'server_error', message: 'boom' }), false);
assert.equal(isRecoverableRealtimeError('Realtime SDP failed (503).'), false);

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const voice = readFileSync(join(root, 'lib/voice/poppins-voice-session.ts'), 'utf8');
assert.match(voice, /isRecoverableRealtimeError/);
assert.match(voice, /pendingStageTap/);
assert.match(voice, /responseInFlight/);
const notify = voice.slice(voice.indexOf('notifyStageTap('));
assert.match(notify, /response\.cancel/);
assert.ok(
  notify.indexOf('responseInFlight') >= 0 || notify.indexOf("state === 'speaking'") >= 0,
  'do not cancel while merely listening'
);

console.log('PASS realtime-error');

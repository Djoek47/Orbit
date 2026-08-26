/**
 * IUI tap must not hang up the live Realtime session.
 * Run: npx tsx lib/poppins/realtime-error.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  disposeRealtimeError,
  isRecoverableRealtimeError,
  planStageTap,
  simEvent,
  simTap,
  type TapSim,
} from './realtime-error';

function fresh(): TapSim {
  return {
    phase: 'listening',
    responseInFlight: false,
    hungUp: false,
    sent: [],
    pending: false,
  };
}

assert.equal(planStageTap('listening', false), 'inject_now');
assert.equal(planStageTap('speaking', false), 'cancel_then_inject');
assert.equal(planStageTap('thinking', false), 'cancel_then_inject');
assert.equal(planStageTap('listening', true), 'cancel_then_inject');
assert.equal(planStageTap('tools', true), 'queue_until_idle');

assert.equal(
  isRecoverableRealtimeError({ code: 'response_cancel_not_active' }),
  true
);
assert.equal(
  isRecoverableRealtimeError({
    error: {
      code: 'conversation_already_has_active_response',
      message: 'Conversation already has an active response in progress',
    },
  }),
  true
);
assert.equal(
  isRecoverableRealtimeError('Cancellation failed: no active response found'),
  true
);
assert.equal(isRecoverableRealtimeError({ code: 'server_error', message: 'boom' }), false);
assert.equal(disposeRealtimeError({ code: 'server_error' }), 'hangup');
assert.equal(
  disposeRealtimeError({ code: 'response_cancel_not_active' }),
  'inject_pending_tap'
);
assert.equal(
  disposeRealtimeError({ code: 'conversation_already_has_active_response' }),
  'keep_going'
);

{
  const after = simTap(fresh(), { needsReply: true });
  assert.equal(after.hungUp, false);
  assert.deepEqual(after.sent, ['conversation.item.create', 'response.create']);
  assert.ok(!after.sent.includes('response.cancel'), 'listening tap must not cancel');
}

{
  let s = simEvent(fresh(), 'response.created');
  s = simTap(s, { needsReply: true });
  assert.deepEqual(s.sent, ['response.cancel']);
  assert.equal(s.pending, true);
  s = simEvent(s, 'response.done');
  assert.equal(s.hungUp, false);
  assert.ok(s.sent.includes('conversation.item.create'), 'choice reaches OpenAI after cancel');
}

{
  let s = simTap({ ...fresh(), phase: 'speaking', responseInFlight: true }, { needsReply: true });
  s = simEvent(s, 'error', { code: 'response_cancel_not_active' });
  assert.equal(s.hungUp, false, 'cancel-not-active must not cook the call');
  assert.ok(s.sent.includes('conversation.item.create'));
}

{
  const s = simEvent(fresh(), 'error', { code: 'server_error', message: 'boom' });
  assert.equal(s.hungUp, true);
}

{
  let s = simTap({ ...fresh(), phase: 'tools', responseInFlight: true }, { needsReply: true });
  assert.deepEqual(s.sent, []);
  assert.equal(s.pending, true);
  s = { ...s, phase: 'listening', responseInFlight: false };
  s = simEvent(s, 'response.done');
  assert.equal(s.hungUp, false);
  assert.ok(s.sent.includes('conversation.item.create'));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const voice = readFileSync(join(root, 'lib/voice/poppins-voice-session.ts'), 'utf8');
assert.match(voice, /planStageTap/);
assert.match(voice, /disposeRealtimeError/);
assert.match(voice, /pausedForTools/);
assert.match(voice, /response\.cancelled/);

console.log('PASS realtime-error');

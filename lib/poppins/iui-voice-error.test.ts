/**
 * Run: npx tsx lib/poppins/iui-voice-error.test.ts
 */

import {
  classifyIuiVoiceError,
  copyIuiVoiceError,
  iuiVoiceErrorCopy,
  shouldOfferKeyboard,
  stringifyVoiceError,
} from '@/lib/poppins/iui-voice-error';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(classifyIuiVoiceError('Permission denied') === 'mic_denied', 'mic');
assert(classifyIuiVoiceError('NotAllowedError') === 'mic_denied', 'notallowed');
assert(classifyIuiVoiceError('Sign in required for live voice.') === 'signed_out', 'auth');
assert(classifyIuiVoiceError('Network request failed') === 'offline', 'offline');
assert(classifyIuiVoiceError('Voice needs the TestFlight build (WebRTC).') === 'needs_testflight', 'tf');
assert(classifyIuiVoiceError('Realtime SDP failed (503).') === 'unavailable', 'sdp');
assert(classifyIuiVoiceError('Realtime SDP failed (402).') === 'unavailable', 'sdp402');
assert(classifyIuiVoiceError('Realtime error') === 'unavailable', 'rt');
assert(classifyIuiVoiceError('Invalid_request: unknown_parameter') === 'unavailable', 'openai');
assert(classifyIuiVoiceError('boom') === 'generic', 'generic');

const mic = copyIuiVoiceError('The user denied permission');
assert(mic.offerKeyboard, 'mic opens type');
assert(mic.detail.toLowerCase().includes('denied permission'), 'debug dump stays');
assert(mic.message.includes('Microphone is off'), 'calm line stays');
assert(iuiVoiceErrorCopy('signed_out').includes('Sign in'), 'auth copy');
assert(!shouldOfferKeyboard('signed_out'), 'auth does not force keyboard');
assert(!shouldOfferKeyboard('generic'), 'generic does not force keyboard');

const boom = copyIuiVoiceError('boom');
assert(boom.message.includes('Speak'), 'retry speak');
assert(boom.message.includes('boom'), 'raw generic dump');

const sdp = copyIuiVoiceError(
  'Realtime SDP failed (503): {"error":"EDGE_FUNCTION"} req abc123'
);
assert(sdp.kind === 'unavailable', 'sdp kind');
assert(sdp.message.includes('503'), 'status on screen');
assert(sdp.message.includes('EDGE_FUNCTION'), 'body on screen');

assert(
  stringifyVoiceError(new Error('getUserMedia failed')).includes('getUserMedia failed'),
  'error object'
);

console.log('PASS iui-voice-error');

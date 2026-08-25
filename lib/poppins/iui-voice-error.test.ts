/**
 * Run: npx tsx lib/poppins/iui-voice-error.test.ts
 */

import {
  classifyIuiVoiceError,
  copyIuiVoiceError,
  iuiVoiceErrorCopy,
  shouldOfferKeyboard,
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
assert(!mic.message.toLowerCase().includes('denied permission'), 'no dump');
assert(iuiVoiceErrorCopy('signed_out').includes('Sign in'), 'auth copy');
assert(!shouldOfferKeyboard('signed_out'), 'auth does not force keyboard');
assert(!shouldOfferKeyboard('generic'), 'generic does not force keyboard');
assert(copyIuiVoiceError('boom').message.includes('Speak'), 'retry speak');

console.log('PASS iui-voice-error');

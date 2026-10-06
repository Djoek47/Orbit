import assert from 'node:assert/strict';
import { devicePreviewProsody, voicePreviewPhrase } from '@/lib/ai/voice-preview-copy';
import { POPPINS_VOICES } from '@/lib/ai/poppins-voices';

assert.equal(voicePreviewPhrase(null), 'Ready when you are.');
assert.equal(voicePreviewPhrase('Nero'), 'Hi Nero. Ready when you are.');
assert.equal(voicePreviewPhrase('  Emma  '), 'Hi Emma. Ready when you are.');

const rose = POPPINS_VOICES[0]!;
const indigo = POPPINS_VOICES[POPPINS_VOICES.length - 1]!;
const roseProsody = devicePreviewProsody(rose);
const indigoProsody = devicePreviewProsody(indigo);
assert.ok(roseProsody.pitch > indigoProsody.pitch, 'warm end should sound higher');
assert.ok(roseProsody.rate >= indigoProsody.rate, 'cool end may speak a touch slower');

console.log('play-voice-preview.test.ts: ok');

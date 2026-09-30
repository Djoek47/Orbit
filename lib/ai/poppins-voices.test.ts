import assert from 'node:assert/strict';

import {
  DEFAULT_POPPINS_VOICE,
  POPPINS_VOICES,
  isPoppinsVoiceId,
  poppinsVoice,
  resolvePoppinsVoice,
  voiceAtPosition,
} from '@/lib/ai/poppins-voices';

// The wheel is ordered, spans end to end, and every stop has a colour.
assert.equal(POPPINS_VOICES[0]!.position, 0);
assert.equal(POPPINS_VOICES[POPPINS_VOICES.length - 1]!.position, 1);
for (let i = 1; i < POPPINS_VOICES.length; i += 1) {
  assert.ok(POPPINS_VOICES[i]!.position > POPPINS_VOICES[i - 1]!.position, 'wheel is in order');
}
for (const voice of POPPINS_VOICES) {
  assert.match(voice.color, /^#[0-9A-F]{6}$/i, `${voice.label} has a colour`);
  assert.ok(voice.label && voice.hint, `${voice.id} is labelled`);
}

// Ids round-trip; anything else falls back rather than blowing up.
assert.equal(isPoppinsVoiceId('coral'), true);
assert.equal(isPoppinsVoiceId('nonsense'), false);
assert.equal(poppinsVoice('cedar').label, 'Indigo');
assert.equal(poppinsVoice(undefined).id, DEFAULT_POPPINS_VOICE);
assert.equal(poppinsVoice('nonsense').id, DEFAULT_POPPINS_VOICE);

// A household that picked a voice keeps it.
assert.equal(resolvePoppinsVoice({ voiceId: 'marin' }), 'marin');

// One set up before the wheel keeps the sound of the character it had.
const legacy = (id: string) => ({ steward: 'marin', intelligence: 'cedar' })[id];
assert.equal(resolvePoppinsVoice({ legacyProfileId: 'steward', legacyVoiceFor: legacy }), 'marin');
assert.equal(resolvePoppinsVoice({ legacyProfileId: 'intelligence', legacyVoiceFor: legacy }), 'cedar');
// A character whose voice isn't on the wheel falls back.
assert.equal(
  resolvePoppinsVoice({ legacyProfileId: 'ghost', legacyVoiceFor: () => 'ballad' }),
  DEFAULT_POPPINS_VOICE
);
// Nothing stored at all.
assert.equal(resolvePoppinsVoice({}), DEFAULT_POPPINS_VOICE);
// The new setting wins over the old one.
assert.equal(
  resolvePoppinsVoice({ voiceId: 'sage', legacyProfileId: 'steward', legacyVoiceFor: legacy }),
  'sage'
);

// Dragging the wheel lands on the nearest stop, and never off the end.
assert.equal(voiceAtPosition(0).id, 'coral');
assert.equal(voiceAtPosition(1).id, 'cedar');
assert.equal(voiceAtPosition(0.41).label, 'Sand');
assert.equal(voiceAtPosition(-5).id, 'coral');
assert.equal(voiceAtPosition(9).id, 'cedar');

console.log('poppins-voices: ok');

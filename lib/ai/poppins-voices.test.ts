import assert from 'node:assert/strict';

import {
  angleForPosition,
  colorAtPosition,
  DEFAULT_POPPINS_VOICE_ID,
  isPoppinsVoiceId,
  poppinsVoice,
  POPPINS_VOICES,
  positionForAngle,
  positionForTouch,
  resolvePoppinsVoice,
  voiceAccessibilityLabel,
  voiceAtPosition,
  wheelSegments,
  WHEEL_START_DEG,
  WHEEL_SWEEP_DEG,
} from './poppins-voices';

// The wheel spans 0 → 1 with no gaps and no duplicates.
assert.equal(POPPINS_VOICES[0]!.position, 0);
assert.equal(POPPINS_VOICES[POPPINS_VOICES.length - 1]!.position, 1);
assert.equal(new Set(POPPINS_VOICES.map((v) => v.id)).size, POPPINS_VOICES.length);
assert.equal(new Set(POPPINS_VOICES.map((v) => v.label)).size, POPPINS_VOICES.length);
for (let i = 1; i < POPPINS_VOICES.length; i += 1) {
  assert.ok(POPPINS_VOICES[i]!.position > POPPINS_VOICES[i - 1]!.position, 'positions ascend');
}

// Warm end is the higher voices, cool end the lower ones.
assert.equal(POPPINS_VOICES[0]!.register, 'higher');
assert.equal(POPPINS_VOICES[POPPINS_VOICES.length - 1]!.register, 'lower');
assert.ok(POPPINS_VOICES.some((v) => v.register === 'even'), 'the middle is neutral');

// Every colour is a six-digit hex — the arc maths parses them directly.
for (const voice of POPPINS_VOICES) {
  assert.match(voice.color, /^#[0-9A-Fa-f]{6}$/, `${voice.label} colour`);
}

// Lookup.
assert.equal(poppinsVoice('cedar').label, 'Indigo');
assert.equal(poppinsVoice('nonsense').id, DEFAULT_POPPINS_VOICE_ID);
assert.equal(poppinsVoice(null).id, DEFAULT_POPPINS_VOICE_ID);
assert.ok(isPoppinsVoiceId('sage'));
assert.ok(!isPoppinsVoiceId('sidekick'));

// A household that picked a character keeps its voice instead of snapping back to Rose.
assert.equal(
  resolvePoppinsVoice({ legacyProfileId: 'intelligence', legacyVoiceFor: () => 'cedar' }),
  'cedar'
);
// The new setting wins over the legacy one.
assert.equal(
  resolvePoppinsVoice({ voiceId: 'sage', legacyProfileId: 'intelligence', legacyVoiceFor: () => 'cedar' }),
  'sage'
);
// A legacy voice we no longer offer falls back rather than reaching the provider.
assert.equal(resolvePoppinsVoice({ legacyProfileId: 'x', legacyVoiceFor: () => 'nope' }), DEFAULT_POPPINS_VOICE_ID);
assert.equal(resolvePoppinsVoice({}), DEFAULT_POPPINS_VOICE_ID);

// Snapping.
assert.equal(voiceAtPosition(0).id, POPPINS_VOICES[0]!.id);
assert.equal(voiceAtPosition(1).id, POPPINS_VOICES[POPPINS_VOICES.length - 1]!.id);
assert.equal(voiceAtPosition(-4).id, POPPINS_VOICES[0]!.id);
assert.equal(voiceAtPosition(9).id, POPPINS_VOICES[POPPINS_VOICES.length - 1]!.id);
// Just past a voice's own position still snaps to it.
const third = POPPINS_VOICES[2]!;
assert.equal(voiceAtPosition(third.position + 0.02).id, third.id);

// Angle round-trips.
assert.equal(angleForPosition(0), WHEEL_START_DEG);
assert.equal(angleForPosition(1), WHEEL_START_DEG + WHEEL_SWEEP_DEG);
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  assert.ok(Math.abs(positionForAngle(angleForPosition(p)) - p) < 1e-9, `round trip ${p}`);
}
// Off the arc clamps instead of wrapping.
assert.equal(positionForAngle(WHEEL_START_DEG - 40), 0);
assert.equal(positionForAngle(WHEEL_START_DEG + WHEEL_SWEEP_DEG + 40), 1);

// A touch straight up is the middle of the arc; left and right are its ends.
assert.ok(Math.abs(positionForTouch(0, -100) - 0.5) < 0.01, 'twelve o’clock is the middle');
assert.ok(positionForTouch(-100, 0) < 0.2, 'nine o’clock is the warm end');
assert.ok(positionForTouch(100, 0) > 0.8, 'three o’clock is the cool end');
// Straight down is in the gap: it must pin to an end, never wrap through it.
const below = positionForTouch(0, 100);
assert.ok(below === 0 || below === 1, 'the gap pins to an end');
assert.equal(positionForTouch(-6, 100), 0, 'below and left pins to the warm end');
assert.equal(positionForTouch(6, 100), 1, 'below and right pins to the cool end');

// The blend hits each voice's own colour exactly, and every step is a valid hex.
for (const voice of POPPINS_VOICES) {
  assert.equal(colorAtPosition(voice.position).toLowerCase(), voice.color.toLowerCase(), voice.label);
}
const segments = wheelSegments(40);
assert.equal(segments.length, 40);
assert.equal(segments[0]!.from, 0);
assert.equal(segments[segments.length - 1]!.to, 1);
for (const segment of segments) {
  assert.match(segment.color, /^#[0-9a-f]{6}$/i);
  assert.ok(segment.to > segment.from);
}
// Consecutive segments touch — no hairline gaps in the arc.
for (let i = 1; i < segments.length; i += 1) {
  assert.equal(segments[i]!.from, segments[i - 1]!.to);
}

// The label a screen reader reads never contains a gendered word.
for (const voice of POPPINS_VOICES) {
  const label = voiceAccessibilityLabel(voice);
  assert.ok(label.includes(voice.label));
  assert.ok(!/female|male|man|woman/i.test(label), `${voice.label} label stays about the sound`);
}

console.log('poppins-voices: ok');

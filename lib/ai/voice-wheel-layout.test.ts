/**
 * Voice wheel layout contract — the dial owns its gestures and paints solid ends.
 *
 * Dragging used to dismiss Settings; swatches were tiny; the arc tips looked hollow.
 * Run: npx tsx lib/ai/voice-wheel-layout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const wheel = read('components/orbit/poppins/voice-wheel.tsx');
const settings = read('app/settings.tsx');
const keyboard = read('components/orbit/keyboard-screen.tsx');
const panel = read('components/orbit/poppins/poppins-settings-panel.tsx');

assert.match(wheel, /GestureDetector/, 'uses gesture-handler so the dial wins over the sheet');
assert.match(wheel, /Gesture\.Pan\(\)/, 'pan owns the drag');
assert.match(wheel, /minDistance\(0\)/, 'claims the first pixel — no head-start for swipe-back');
assert.match(wheel, /HIT_PAD/, 'padded hit target around the dial');
assert.match(wheel, /onInteractionChange/, 'tells Settings when a drag is live');
assert.match(wheel, /withSpring/, 'colour changes animate');
assert.match(wheel, /STROKE \/ 2/, 'solid end caps fill the hollow tips');
assert.match(wheel, /strokeLinecap=\{isEnd \? 'round' : 'butt'\}/, 'round caps on the arc ends');
assert.match(wheel, /hitSlop=\{10\}/, 'swatches are easy to tap');
assert.match(wheel, /fullScreenGestureEnabled: false/, 'disables full-screen swipe while mounted');
assert.match(wheel, /WHEEL_START_DEG/, 'knob worklet uses the shared sweep constants');

assert.match(settings, /wheelDragging/, 'Settings tracks wheel interaction');
assert.match(settings, /scrollEnabled=\{!wheelDragging\}/, 'scroll locks while dragging');
assert.match(settings, /gestureEnabled: !wheelDragging/, 'sheet swipe only locks while the dial is dragged');
assert.match(settings, /fullScreenGestureEnabled: !wheelDragging/);
assert.match(settings, /onVoiceWheelInteraction=\{setWheelDragging\}/);
assert.match(settings, /closeSettingsModal/, 'X dismisses the modal without a zombie touch layer');

assert.match(keyboard, /scrollEnabled\?: boolean/, 'KeyboardScreen can lock scroll');
assert.match(panel, /onVoiceWheelInteraction/, 'panel forwards the drag signal');

console.log('voice-wheel-layout: ok');

/** Switch mark: one arrow per person (⇄ for two), all inside the drawable box. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('components/orbit/switch-people-icon.tsx', 'utf8');
assert.match(src, /n === 2\) return twoArrows/, 'two people: ⇄');
assert.match(src, /n <= 4\) return polygonLoop/, 'three/four: triangle and lozenge');
assert.match(src, /startDeg = -90/, 'a corner on top — the square stands as a lozenge');
assert.match(src, /ringLoop\(n\)/, 'five/six: ring');
const setup = readFileSync('app/setup-kid-device.tsx', 'utf8');
assert.match(setup, /hostedMembers\.length === 1 \?[\s\S]{0,40}<Avatar/, 'one person: their face');
assert.match(readFileSync('components/orbit/make-tab-bar.tsx', 'utf8'), /switchPeopleCount\} size=\{22\} color=\{ink\} spin/);
console.log('switch-arrows ok');

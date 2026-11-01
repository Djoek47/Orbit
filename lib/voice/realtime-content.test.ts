/**
 * Run: npx tsx lib/voice/realtime-content.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { realtimeTextContent } from '@/lib/voice/realtime-content';

assert.equal(realtimeTextContent('user', 'wash the car')[0]?.type, 'input_text');
assert.equal(realtimeTextContent('system', 'listen')[0]?.type, 'input_text');
assert.equal(realtimeTextContent('assistant', 'Tap to continue.')[0]?.type, 'output_text');
assert.equal(realtimeTextContent('assistant', 'Tap to continue.')[0]?.text, 'Tap to continue.');

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const voice = readFileSync(join(root, 'lib/voice/poppins-voice-session.ts'), 'utf8');
assert.match(voice, /realtimeTextContent\(turn\.role, turn\.text\)/);
assert.equal(
  /role: turn\.role,\s*content: \[\{ type: 'input_text'/.test(voice),
  false,
  'assistant seed turns must not all be input_text'
);

console.log('PASS realtime-content');

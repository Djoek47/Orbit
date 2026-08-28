/**
 * Voice tools must read the live household, not the connect-time freeze.
 * Run: npx tsx lib/voice/live-household.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveLiveVoiceHousehold } from '@/lib/voice/voice-lifecycle';
import type { HouseholdSnapshot } from '@/types/orbit';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const connectTime = {
  id: 'hh1',
  householdName: 'Test',
  greetingName: 'Alex',
  tasks: [],
  groceries: [],
  events: [],
  members: [{ id: 'm1', name: 'Alex', role: 'admin', status: 'active' }],
  rewards: [],
  itineraries: [],
  places: [],
} as unknown as HouseholdSnapshot;

const afterHold = {
  ...connectTime,
  tasks: [
    {
      id: 't-dishes',
      title: 'Tend to the dishes',
      assignee: 'Alex',
      due: 'Today',
      status: 'Pending',
      category: 'kitchen_dining',
      xp: 10,
    },
  ],
} as unknown as HouseholdSnapshot;

const live = resolveLiveVoiceHousehold(connectTime, () => afterHold);
assert.equal(live?.tasks[0]?.title, 'Tend to the dishes');

const payloadTasks = (live?.tasks ?? [])
  .filter((task) => task.status !== 'Completed')
  .map((task) => task.title);
assert.equal(
  payloadTasks.includes('Tend to the dishes'),
  true,
  'voice tool payload includes a task added after connect'
);

const frozen = resolveLiveVoiceHousehold(connectTime, () => connectTime);
assert.equal(frozen?.tasks.length, 0);

const voice = source('lib/voice/poppins-voice-session.ts');
assert.match(voice, /resolveLiveVoiceHousehold/);
assert.match(voice, /notifyTaskOnTasks/);
assert.match(voice, /The task “\$\{trimmed\}” is on Tasks now/);

const stage = source('components/orbit/poppins-stage.tsx');
assert.match(stage, /onVoiceTaskCreated/);
assert.match(stage, /if \(created\) onVoiceTaskCreated\?\.\(created\)/);

const poppins = source('app/(tabs)/poppins.tsx');
assert.match(poppins, /syncHousehold/);
assert.match(poppins, /notifyTaskOnTasks/);
assert.match(poppins, /getHousehold: \(\) => householdRef\.current/);

console.log('PASS live-household');

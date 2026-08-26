/**
 * Two-mode IUI: talking fills unknown beats; a tap wins while speaking.
 * Run: npx tsx lib/poppins/two-mode-iui.test.ts
 */

import assert from 'node:assert/strict';

import { hearAndDrive } from '@/lib/poppins/aiuic';
import { parseHouseholdIntent } from '@/lib/poppins/ui-intent';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import { interpretStageSpeech } from '@/lib/poppins/ui-speech';
import { formatStageTapUserLine } from '@/lib/poppins/stage-tap';
import {
  classifyIuiVoiceError,
  copyIuiVoiceError,
} from '@/lib/poppins/iui-voice-error';

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
poppinsUiOrchestrator.setTapHandler(null);
poppinsUiOrchestrator.setCommitHandler(null);

const kitchenIntent = parseHouseholdIntent('Schedule a task for kitchen tomorrow');
assert.equal(kitchenIntent[0]?.type, 'create_task_draft');
assert.equal(kitchenIntent[0]?.category, 'kitchen_dining');
assert.equal(kitchenIntent[0]?.due, 'Tomorrow');
assert.ok(!kitchenIntent[0]?.title, 'generic schedule-a-task must not fake a title');

hearAndDrive('Schedule a task for kitchen tomorrow', ['Alex', 'Maya']);
const kitchenPayload = poppinsUiOrchestrator.getState().playlist[0]?.payload;
assert.equal(kitchenPayload?.category, 'kitchen_dining');
assert.equal(kitchenPayload?.due, 'Tomorrow');
assert.notEqual(kitchenPayload?.composeStep, 'category');
assert.ok(
  kitchenPayload?.composeStep === 'who' ||
    kitchenPayload?.composeStep === 'task' ||
    kitchenPayload?.composeStep === 'ready'
);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
hearAndDrive('Schedule a task for me for kitchen tomorrow', ['Alex', 'Maya'], {
  selfName: 'Alex',
});
const forMe = poppinsUiOrchestrator.getState().playlist[0]?.payload;
assert.equal(forMe?.assignee, 'Alex');
assert.equal(forMe?.category, 'kitchen_dining');
assert.equal(forMe?.due, 'Tomorrow');
assert.equal(forMe?.composeStep, 'task');

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
const tend = parseHouseholdIntent('tend to the dishes, assign it to me', {
  memberNames: ['Alex', 'Maya'],
  selfName: 'Alex',
});
assert.equal(tend[0]?.type, 'create_task_draft');
assert.match(String(tend[0]?.title ?? ''), /tend/i);
assert.equal(tend[0]?.assignee, 'Alex');
assert.ok(!tend[0]?.libraryTaskId, 'free-form title is not a catalog id');

hearAndDrive('tend to the dishes, assign it to me', ['Alex', 'Maya'], { selfName: 'Alex' });
const created = poppinsUiOrchestrator.getState().playlist[0]?.payload;
assert.equal(created?.assignee, 'Alex');
assert.match(String(created?.title ?? ''), /tend/i);
assert.equal(created?.composeStep, 'task');
assert.equal(created?.composeReady, false);

const daily = parseHouseholdIntent('tend to the dishes every day, assign them to me', {
  memberNames: ['Alex', 'Maya'],
  selfName: 'Alex',
});
assert.equal(daily[0]?.repeat, 'Daily');
assert.equal(daily[0]?.due, 'Today');
assert.match(String(daily[0]?.title ?? ''), /tend/i);

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
hearAndDrive('load the dishwasher for me tomorrow', ['Alex'], { selfName: 'Alex' });
const known = poppinsUiOrchestrator.getState().playlist[0]?.payload;
assert.equal(known?.composeReady, true, 'known catalog chore with who+when skips to confirm');

poppinsUiOrchestrator.clear();
poppinsUiOrchestrator.setSpeaking(false);
let earlyCommit = 0;
poppinsUiOrchestrator.setCommitHandler(async () => {
  earlyCommit += 1;
});
hearAndDrive('tend to the dishes, assign it to me', ['Alex', 'Maya'], { selfName: 'Alex' });
void poppinsUiOrchestrator.confirm({ fromTap: true });
assert.equal(earlyCommit, 0, 'tap to confirm does nothing until compose is ready');
poppinsUiOrchestrator.setCommitHandler(null);

const loadExact = parseHouseholdIntent('load the dishes for me tomorrow', {
  memberNames: ['Alex'],
  selfName: 'Alex',
});
assert.ok(loadExact[0]?.libraryTaskId || /load/i.test(String(loadExact[0]?.title ?? '')));

const todayIntent = parseHouseholdIntent('Set up a task for today');
assert.equal(todayIntent[0]?.type, 'create_task_draft');
assert.equal(todayIntent[0]?.due, 'Today');
assert.ok(!todayIntent[0]?.category);

const combined = interpretStageSpeech('kitchen tomorrow', { live: true });
assert.equal(combined.kind, 'revise');
if (combined.kind === 'revise') {
  assert.equal(combined.patch.category, 'kitchen_dining');
  assert.equal(combined.patch.due, 'Tomorrow');
}

const meSteer = interpretStageSpeech("It's for me", {
  live: true,
  selfName: 'Alex',
  memberNames: ['Alex', 'Maya'],
});
assert.equal(meSteer.kind, 'revise');
if (meSteer.kind === 'revise') assert.equal(meSteer.patch.assignee, 'Alex');

assert.equal(
  formatStageTapUserLine({ kind: 'category', text: 'Kitchen' }),
  'On the IUI I chose Kitchen.'
);
assert.equal(
  formatStageTapUserLine({ kind: 'confirm', text: 'assign now' }),
  'On the IUI I chose assign now.'
);

assert.equal(classifyIuiVoiceError('Invalid_request: unknown_parameter'), 'unavailable');
assert.equal(copyIuiVoiceError('boom').message, "Couldn't start voice. Tap Speak to try again.");

async function tapWinsWhileSpeaking() {
  poppinsUiOrchestrator.clear();
  poppinsUiOrchestrator.setSpeaking(false);
  let committed = 0;
  poppinsUiOrchestrator.setCommitHandler(async (beat) => {
    if (beat.scene === 'task_compose') committed += 1;
  });
  poppinsUiOrchestrator.drive(
    [
      {
        type: 'create_task_draft',
        title: 'Load the dishwasher',
        assignee: 'Alex',
        due: 'Today',
        category: 'kitchen_dining',
      },
    ],
    { replace: true }
  );
  poppinsUiOrchestrator.setSpeaking(true);
  assert.equal(poppinsUiOrchestrator.getState().speaking, true);
  assert.equal(poppinsUiOrchestrator.getState().holding, false);
  assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.scene, 'task_compose');

  await poppinsUiOrchestrator.confirm();
  assert.equal(committed, 0, 'auto confirm waits while speaking');
  assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.scene, 'task_compose');

  const seen: { tap: { kind: string; text: string } | null } = { tap: null };
  poppinsUiOrchestrator.setTapHandler((event) => {
    seen.tap = event;
  });
  await poppinsUiOrchestrator.confirm({ fromTap: true });
  assert.equal(seen.tap?.kind, 'confirm');
  assert.equal(seen.tap?.text, 'assign now');
  assert.equal(poppinsUiOrchestrator.getState().speaking, false);
  assert.equal(committed, 1, 'finger press settles the write');

  poppinsUiOrchestrator.clear();
  poppinsUiOrchestrator.setSpeaking(false);
  hearAndDrive('Set up a task for today', ['Alex', 'Maya']);
  poppinsUiOrchestrator.setSpeaking(true);
  poppinsUiOrchestrator.chooseFromTap(
    { assignee: 'Alex', spokenName: 'Alex' },
    'Alex',
    'face'
  );
  assert.equal(seen.tap?.kind, 'face');
  assert.equal(seen.tap?.text, 'Alex');
  assert.equal(poppinsUiOrchestrator.getState().speaking, false);
  assert.equal(poppinsUiOrchestrator.getState().playlist[0]?.payload.assignee, 'Alex');
  assert.notEqual(poppinsUiOrchestrator.getState().playlist[0]?.payload.composeStep, 'who');

  poppinsUiOrchestrator.setTapHandler(null);
  poppinsUiOrchestrator.clear();
  poppinsUiOrchestrator.setSpeaking(false);
  console.log('two-mode iui: ok');
}

void tapWinsWhileSpeaking().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

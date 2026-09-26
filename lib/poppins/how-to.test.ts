/**
 * Run: npx --yes tsx lib/poppins/how-to.test.ts
 */
import assert from 'node:assert/strict';

import { buildActEvent } from '@/lib/ai/act-events';
import {
  HOW_TO_INDEX,
  coachActTokens,
  howToUiAction,
  isCoachDoItSpeech,
  isCoachStopSpeech,
  matchHowTo,
} from '@/lib/poppins/how-to';

assert.equal(HOW_TO_INDEX.length, 22, 'twenty-two how-to entries');

const cases: Array<{ q: string; id: string }> = [
  { q: 'how do I make a chore need a photo?', id: 'proof-on-chore' },
  { q: 'family ipad', id: 'family-ipad' },
  { q: 'invite an adult', id: 'invite-adult' },
  { q: 'house rules', id: 'house-rules' },
  { q: 'what is recess', id: 'recess' },
  { q: 'how does allowance work', id: 'allowance' },
  { q: 'mint a reward', id: 'mint-reward' },
  { q: 'approve a claim', id: 'approve-claim' },
  { q: 'how do ranks work', id: 'ranks-fairness' },
  { q: 'household members', id: 'invite-members' },
  { q: 'assign homework', id: 'homework' },
  { q: 'groceries vs clothing', id: 'groceries-vs-clothing' },
  { q: 'shopping mode', id: 'shopping-mode' },
  { q: 'quiet hours', id: 'quiet-hours' },
  { q: 'push notifications', id: 'notifications' },
  { q: 'what is an action', id: 'act-meter' },
  { q: 'base vs max', id: 'base-vs-max' },
  { q: 'switch profiles', id: 'switch-profiles' },
  { q: 'how do I delete a task', id: 'delete-task' },
  { q: 'recurring chores', id: 'recurring-chores' },
  { q: 'how do trips work', id: 'itineraries' },
  { q: 'saved places', id: 'saved-places' },
];

for (const { q, id } of cases) {
  const hit = matchHowTo(q);
  assert.ok(hit, `expected match for “${q}”`);
  assert.equal(hit!.id, id, `“${q}” → ${id}`);
}

assert.equal(matchHowTo('add jam to the list'), null, 'unmatched falls through to the model');
assert.equal(matchHowTo('dishes for Mia tomorrow'), null, 'act utterance is not teaching');

const action = howToUiAction(HOW_TO_INDEX[0]!, 'how do I make a chore need a photo?');
assert.equal(action.type, 'present_ui_scene');
assert.equal(action.scene, 'coach_steps');
assert.equal((action.payload as { howToId?: string }).howToId, 'proof-on-chore');

assert.equal(coachActTokens(), 0);
const coachEvent = buildActEvent({
  memberId: 'm1',
  memberName: 'Sarah',
  actKind: 'coach',
  mode: 'spoken',
  outcome: 'committed',
});
assert.equal(coachEvent.tokens, 0, 'coach turn records 0 actions even on Speak back');
assert.equal(coachEvent.actKind, 'coach');

assert.equal(isCoachDoItSpeech('do it for me'), true);
assert.equal(isCoachStopSpeech('stop the tour'), true);
assert.equal(isCoachStopSpeech('add milk'), false);

console.log('how-to.test.ts: ok');

/**
 * Run: npx --yes tsx lib/ai/credits.test.ts
 */
import assert from 'node:assert/strict';

import {
  AI_TRIP_USD,
  buildUsageEvent,
  meterCaption,
  personalUsd,
  summarizeAiUsage,
  usdForTokens,
} from '@/lib/ai/credits';

function assertClose(actual: number, expected: number, msg: string) {
  assert.ok(Math.abs(actual - expected) < 0.0002, `${msg}: ${actual} vs ${expected}`);
}

const cheap = usdForTokens(1_000_000, 0, 'gpt-5.6-luna');
assertClose(cheap, 5, '1M input luna');

const voiceFloor = buildUsageEvent({
  memberId: 'm1',
  memberName: 'Sarah',
  kind: 'voice',
  model: 'gpt-realtime-2.1',
  inputTokens: 0,
  outputTokens: 0,
  usd: 0,
});
assert.ok(voiceFloor.usd >= 0.06, 'voice floor when usage missing');

const members = [
  { id: 'm1', name: 'Sarah' },
  { id: 'm2', name: 'David' },
];

const events = [
  buildUsageEvent({
    id: 'e1',
    at: '2026-08-01T10:00:00.000Z',
    memberId: 'm1',
    memberName: 'Sarah',
    kind: 'chat',
    model: 'gpt-5.6-luna',
    inputTokens: 0,
    outputTokens: 0,
    usd: 1.5,
  }),
  buildUsageEvent({
    id: 'e2',
    at: '2026-08-01T12:00:00.000Z',
    memberId: 'm2',
    memberName: 'David',
    kind: 'voice',
    model: 'gpt-realtime-2.1',
    inputTokens: 0,
    outputTokens: 0,
    usd: 2.6,
  }),
];

const before = summarizeAiUsage(events, members);
assert.equal(before.tripped, true, '1.5 + 2.6 trips $4');
assert.equal(before.trippedAt, '2026-08-01T12:00:00.000Z', 'trips on the crossing event');
assertClose(personalUsd(before, 'm1'), 1.5, 'Sarah personal');
assertClose(personalUsd(before, 'm2'), 2.6, 'David personal');
assert.equal(before.byMember[0].name, 'David', 'admin list sorts by spend');
assert.equal(meterCaption(before, 1.5, true).startsWith('Paused'), true, 'admin paused caption');

const under = summarizeAiUsage(
  [
    buildUsageEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      kind: 'chat',
      model: 'gpt-5.6-luna',
      inputTokens: 0,
      outputTokens: 0,
      usd: 0.4,
    }),
  ],
  members
);
assert.equal(under.tripped, false, 'under $4 is live');
assertClose(under.remainingUsd, AI_TRIP_USD - 0.4, 'remaining');
assert.equal(meterCaption(under, 0.4, true), '$0.40 of $4.00', 'admin running caption');

console.log('PASS ai credits $4 trip + per-person');

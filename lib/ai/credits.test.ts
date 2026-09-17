/**
 * Run: npx --yes tsx lib/ai/credits.test.ts
 */
import assert from 'node:assert/strict';

import {
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
  buildUsageEvent,
  mergeUsageEvents,
  meterCaption,
  personalTokens,
  summarizeAiUsage,
  usdForTokens,
} from '@/lib/ai/credits';

function assertClose(actual: number, expected: number, msg: string) {
  assert.ok(Math.abs(actual - expected) < 0.0002, `${msg}: ${actual} vs ${expected}`);
}

const cheap = usdForTokens(1_000_000, 0, 'gpt-5.6-luna');
assertClose(cheap, 0.2, '1M input luna (MEASURED rate after 2026-07-30 cut)');

const lunaRoundTrip = usdForTokens(1_000_000, 1_000_000, 'gpt-5.6-luna');
assertClose(lunaRoundTrip, 1.4, '1M in + 1M out luna');

const realtime = usdForTokens(1_000_000, 0, 'gpt-realtime-2.1');
assertClose(realtime, 32, '1M audio input realtime');

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

const periodEvents = Array.from({ length: 31 }, (_, i) =>
  buildUsageEvent({
    id: `e${i}`,
    at: `2026-08-01T${String(10 + (i % 10)).padStart(2, '0')}:00:00.000Z`,
    memberId: i % 2 === 0 ? 'm1' : 'm2',
    memberName: i % 2 === 0 ? 'Sarah' : 'David',
    kind: 'chat',
    model: 'gpt-5.6-luna',
    inputTokens: 100,
    outputTokens: 50,
    usd: 0.01,
    mode: 'silent',
    chargeAct: true,
  })
);

const dailyTrip = summarizeAiUsage(periodEvents.slice(0, 30), members, {
  now: '2026-08-01T23:00:00.000Z',
  todayKey: '2026-08-01',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
});
assert.equal(dailyTrip.tokensUsedToday, 30, '30 silent acts = daily cap');
assert.equal(dailyTrip.tripped, true, 'daily cap trips Speak');
assert.match(meterCaption(dailyTrip, 15, true), /Paused/, 'admin paused caption');

const under = summarizeAiUsage(
  [
    buildUsageEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      kind: 'chat',
      model: 'gpt-5.6-luna',
      inputTokens: 0,
      outputTokens: 0,
      usd: 0.01,
      mode: 'silent',
      chargeAct: true,
      at: '2026-08-15T12:00:00.000Z',
    }),
  ],
  members,
  {
    now: '2026-08-15T18:00:00.000Z',
    todayKey: '2026-08-15',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
  }
);
assert.equal(under.tripped, false, 'under caps is live');
assert.equal(under.tokensUsedThisPeriod, 1);
assert.equal(under.tokensRemaining, Math.min(TOKENS_PER_MONTH - 1, TOKENS_PER_DAY - 1));
assert.equal(
  meterCaption(under, personalTokens(under, 'm1'), true),
  `1 of ${TOKENS_PER_MONTH} this month · 1 today`,
  'admin running caption'
);
assert.equal(
  meterCaption(under, personalTokens(under, 'm1'), false),
  `1 of ${TOKENS_PER_DAY} today`,
  'member sees daily only'
);

const liveWeighted = summarizeAiUsage(
  [
    buildUsageEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      kind: 'voice',
      model: 'gpt-realtime-2.1',
      inputTokens: 0,
      outputTokens: 0,
      usd: 0.05,
      mode: 'live',
      chargeAct: true,
      at: '2026-08-15T12:00:00.000Z',
    }),
  ],
  members,
  {
    now: '2026-08-15T18:00:00.000Z',
    todayKey: '2026-08-15',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
  }
);
assert.equal(liveWeighted.tokensUsedThisPeriod, 40, 'live act weighs 40');

const merged = mergeUsageEvents([periodEvents[0]!], [periodEvents[0]!, periodEvents[1]!]);
assert.equal(merged.length, 2, 'usage merge unions by id');

console.log('PASS ai credits token meter');

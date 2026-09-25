/**
 * Run: npx --yes tsx lib/ai/credits.test.ts
 * User-facing act tokens: lib/ai/act-events.test.ts
 */
import assert from 'node:assert/strict';

import {
  buildUsageEvent,
  mergeUsageEvents,
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

const cogsEvents = Array.from({ length: 5 }, (_, i) =>
  buildUsageEvent({
    id: `e${i}`,
    at: `2026-08-01T1${i}:00:00.000Z`,
    memberId: i % 2 === 0 ? 'm1' : 'm2',
    memberName: i % 2 === 0 ? 'Sarah' : 'David',
    kind: 'monitor',
    model: 'gpt-5.6-luna',
    inputTokens: 100,
    outputTokens: 50,
    usd: 0.01,
    mode: 'silent',
    chargeAct: true,
  })
);

const cogs = summarizeAiUsage(cogsEvents, members, {
  now: '2026-08-01T23:00:00.000Z',
  todayKey: '2026-08-01',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
});
assert.equal(cogs.tokensUsedThisPeriod, 0, 'COGS events never invent act tokens');
assert.equal(cogs.tripped, false, 'COGS summary never trips Speak');
assert.ok(cogs.householdUsd > 0, 'USD still accumulates');

const withExplicitTokens = summarizeAiUsage(
  [
    buildUsageEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      kind: 'chat',
      model: 'gpt-5.6-luna',
      inputTokens: 0,
      outputTokens: 0,
      usd: 0.01,
      tokens: 7,
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
assert.equal(withExplicitTokens.tokensUsedThisPeriod, 7, 'explicit tokens still count if set');

const merged = mergeUsageEvents([cogsEvents[0]!], [cogsEvents[0]!, cogsEvents[1]!]);
assert.equal(merged.length, 2, 'usage merge unions by id');

assert.equal(buildUsageEvent({
  memberId: 'm1',
  memberName: 'Sarah',
  kind: 'chat',
  model: 'gpt-5.6-luna',
  inputTokens: 10,
  outputTokens: 5,
  chargeAct: true,
  mode: 'spoken',
}).tokens, 0, 'chargeAct no longer writes act tokens onto AiUsageEvent');

console.log('PASS ai credits COGS ledger');

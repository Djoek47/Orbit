/**
 * Run: npx --yes tsx lib/ai/act-events.test.ts
 */
import assert from 'node:assert/strict';

import {
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
  TOKEN_WEIGHT_QUIET,
  TOKEN_WEIGHT_SPEAK_BACK,
} from '@/constants/poppins-ai-rates';
import {
  axesFromPoppinsMode,
  buildActEvent,
  personalActTokens,
  summarizeActUsage,
} from '@/lib/ai/act-events';
import { meterCaption } from '@/lib/ai/credits';

assert.equal(axesFromPoppinsMode('silent').tokens, TOKEN_WEIGHT_QUIET);
assert.equal(axesFromPoppinsMode('spoken').tokens, TOKEN_WEIGHT_SPEAK_BACK);
assert.equal(axesFromPoppinsMode('live').tokens, TOKEN_WEIGHT_SPEAK_BACK);
assert.equal(axesFromPoppinsMode('live').voice, 'spoken');
assert.equal(axesFromPoppinsMode('spoken').voice, 'spoken');
assert.equal(TOKEN_WEIGHT_SPEAK_BACK, 35);
assert.equal(TOKEN_WEIGHT_QUIET, 1);

const members = [
  { id: 'm1', name: 'Sarah' },
  { id: 'm2', name: 'David' },
];

const periodEvents = Array.from({ length: TOKENS_PER_DAY + 1 }, (_, i) =>
  buildActEvent({
    id: `a${i}`,
    at: `2026-08-01T${String(10 + (i % 10)).padStart(2, '0')}:00:00.000Z`,
    memberId: i % 2 === 0 ? 'm1' : 'm2',
    memberName: i % 2 === 0 ? 'Sarah' : 'David',
    actKind: 'task',
    mode: 'silent',
  })
);

const dailyTrip = summarizeActUsage(periodEvents.slice(0, TOKENS_PER_DAY), members, {
  now: '2026-08-01T23:00:00.000Z',
  todayKey: '2026-08-01',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
});
assert.equal(dailyTrip.tokensUsedToday, TOKENS_PER_DAY);
assert.equal(dailyTrip.tripped, true, 'daily cap trips Speak');
assert.match(
  meterCaption(
    {
      tokensUsedThisPeriod: dailyTrip.tokensUsedThisPeriod,
      tokensUsedToday: dailyTrip.tokensUsedToday,
      tripped: dailyTrip.tripped,
    },
    15,
    true
  ),
  /Paused/,
  'admin paused caption'
);

const under = summarizeActUsage(
  [
    buildActEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      actKind: 'grocery',
      mode: 'silent',
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
assert.equal(under.tripped, false);
assert.equal(under.tokensUsedThisPeriod, 1);
assert.equal(under.tokensRemaining, Math.min(TOKENS_PER_MONTH - 1, TOKENS_PER_DAY - 1));

const live = summarizeActUsage(
  [
    buildActEvent({
      memberId: 'm1',
      memberName: 'Sarah',
      actKind: 'task',
      mode: 'spoken',
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
assert.equal(live.tokensUsedThisPeriod, TOKEN_WEIGHT_SPEAK_BACK);

const committed = buildActEvent({
  id: 'c1',
  beatId: 'beat-1',
  memberId: 'm1',
  memberName: 'Sarah',
  actKind: 'task',
  mode: 'silent',
  at: '2026-08-15T12:00:00.000Z',
});
const undone = buildActEvent({
  id: 'u1',
  beatId: 'beat-1',
  memberId: 'm1',
  memberName: 'Sarah',
  actKind: 'task',
  mode: 'silent',
  outcome: 'undone',
  at: '2026-08-15T12:00:05.000Z',
});
const afterUndo = summarizeActUsage([committed, undone], members, {
  now: '2026-08-15T18:00:00.000Z',
  todayKey: '2026-08-15',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
});
assert.equal(afterUndo.tokensUsedThisPeriod, 0, 'undo reverses charge');
assert.equal(personalActTokens(afterUndo, 'm1'), 0);

console.log('PASS act-events meter');

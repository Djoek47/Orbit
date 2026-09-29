/**
 * Opening policy — listen first, never self-intro.
 * Run: npx --yes tsx --test lib/poppins/opening-policy.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { IuiContinuity } from '@/lib/poppins/iui-continuity';
import { decideOpening, situationLine } from '@/lib/poppins/opening-policy';

const now = 1_700_000_000_000;

function continuity(partial: Partial<IuiContinuity> = {}): IuiContinuity {
  return {
    householdId: 'hh1',
    updatedAt: now,
    turns: [],
    ...partial,
  };
}

test('user already speaking always listens', () => {
  const d = decideOpening({
    householdId: 'hh1',
    hasMetHousehold: false,
    userSpeaking: true,
    now,
  });
  assert.equal(d.mode, 'listen');
  assert.equal(d.instructions, null);
});

test('fresh 4h session listens and does not greet', () => {
  const d = decideOpening({
    continuity: continuity(),
    householdId: 'hh1',
    hasMetHousehold: true,
    desk: { overdueSample: [{ title: 'Dishes', assignee: 'Liam' }] },
    now,
  });
  assert.equal(d.mode, 'listen');
  assert.equal(d.instructions, null);
});

test('open frozen act listens', () => {
  const d = decideOpening({
    continuity: continuity({
      openPlaylist: [{ id: 'b1' } as never],
      openIndex: 0,
    }),
    householdId: 'hh1',
    hasMetHousehold: false,
    now,
  });
  assert.equal(d.mode, 'listen');
});

test('first ever is presence, never a name intro', () => {
  const d = decideOpening({
    householdId: 'hh1',
    hasMetHousehold: false,
    now,
  });
  assert.equal(d.mode, 'presence');
  assert.ok(d.instructions);
  assert.equal(/poppins/i.test(d.instructions ?? ''), false);
  assert.equal(/introduce/i.test(d.instructions ?? ''), true);
});

test('long gap with overdue is a situation, not a hello', () => {
  const d = decideOpening({
    householdId: 'hh1',
    hasMetHousehold: true,
    lastSituationAt: now - 7 * 60 * 60 * 1000,
    desk: { overdueSample: [{ title: 'Dishes', assignee: 'Liam' }] },
    now,
  });
  assert.equal(d.mode, 'situation');
  assert.match(d.instructions ?? '', /Liam still has Dishes/);
  assert.equal(/hi,? i.?m/i.test(d.instructions ?? ''), false);
});

test('situation cooldown keeps listen', () => {
  const d = decideOpening({
    householdId: 'hh1',
    hasMetHousehold: true,
    lastSituationAt: now - 10 * 60 * 1000,
    desk: { overdueSample: [{ title: 'Dishes', assignee: 'Liam' }] },
    now,
  });
  assert.equal(d.mode, 'listen');
});

test('situationLine prefers overdue by who', () => {
  assert.equal(
    situationLine({ overdueSample: [{ title: 'Trash', assignee: 'Maya' }] }),
    'Maya still has Trash. Want a reminder?'
  );
  assert.equal(situationLine({ missingGroceries: ['Milk'] }), 'Milk is still missing. Want a reminder?');
});

test('voice session no longer greets by default', () => {
  const src = readFileSync(path.join(process.cwd(), 'lib/voice/poppins-voice-session.ts'), 'utf8');
  assert.equal(src.includes('Greet briefly'), false);
  assert.match(src, /openerInstructions/);
  assert.match(src, /heardUserBeforeOpen/);
});

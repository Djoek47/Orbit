/**
 * House memory merge + spoken parse.
 * Run: npx --yes tsx --test lib/poppins/house-memory.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assigneeBlockedByMemory,
  emptyHouseMemory,
  formatMemoryHint,
  hasMetHousehold,
  HOUSE_MEMORY_MAX_FACTS,
  isPrivacySensitive,
  markFirstHeard,
  mergeFact,
  parseHouseMemoryUtterance,
  preferredStore,
} from '@/lib/poppins/house-memory';

test('parse dislike and like from speech', () => {
  const dislike = parseHouseMemoryUtterance("Don't assign dishes to Liam");
  assert.equal(dislike?.kind, 'dislike');
  assert.match(dislike?.text ?? '', /Liam/i);

  const like = parseHouseMemoryUtterance('Maya likes cooking dinner');
  assert.equal(like?.kind, 'like');
  assert.equal(like?.subject, 'Maya');

  const routine = parseHouseMemoryUtterance('We always shop at Metro');
  assert.equal(routine?.kind, 'routine');
  assert.equal(routine?.subject, 'house');

  assert.equal(parseHouseMemoryUtterance('Assign dishes to Maya'), null);
});

test('mergeFact newest wins on same subject+kind', () => {
  let mem = emptyHouseMemory('hh1', 1);
  mem = mergeFact(mem, { kind: 'dislike', subject: 'Liam', text: 'no dishes', source: 'spoken' }, 2);
  mem = mergeFact(mem, { kind: 'dislike', subject: 'Liam', text: 'no laundry', source: 'spoken' }, 3);
  assert.equal(mem.facts.length, 1);
  assert.equal(mem.facts[0]?.text, 'no laundry');
  assert.equal(mem.facts[0]?.updatedAt, 3);
});

test('assigneeBlockedByMemory matches dislike to chore', () => {
  const mem = mergeFact(emptyHouseMemory('hh1'), {
    kind: 'dislike',
    subject: 'Liam',
    text: 'Liam should not be assigned dishes',
    source: 'spoken',
  });
  assert.equal(assigneeBlockedByMemory(mem, 'Liam', 'Dishes'), true);
  assert.equal(assigneeBlockedByMemory(mem, 'Maya', 'Dishes'), false);
});

test('privacy-sensitive facts are flagged', () => {
  assert.equal(isPrivacySensitive('prefers Trader Joe’s'), false);
  assert.equal(isPrivacySensitive('his medical diagnosis is private'), true);
});

test('formatMemoryHint is short enough for a prompt', () => {
  const mem = mergeFact(emptyHouseMemory('hh1'), {
    kind: 'routine',
    subject: 'house',
    text: 'We always shop at Metro',
    source: 'spoken',
  });
  const hint = formatMemoryHint(mem);
  assert.match(hint, /House memory/);
  assert.match(hint, /Metro/);
});

test('first heard and preferred store', () => {
  const empty = emptyHouseMemory('hh1');
  assert.equal(hasMetHousehold(empty), false);
  const heard = markFirstHeard(empty, 10);
  assert.equal(heard.firstHeardAt, 10);
  assert.equal(hasMetHousehold(heard), true);
  assert.equal(markFirstHeard(heard, 20).firstHeardAt, 10);

  const mem = mergeFact(emptyHouseMemory('hh1'), {
    kind: 'routine',
    subject: 'house',
    text: 'We always shop at Metro',
    source: 'spoken',
  });
  assert.match(preferredStore(mem) ?? '', /Metro/);
});

test('mergeFact caps at HOUSE_MEMORY_MAX_FACTS', () => {
  let mem = emptyHouseMemory('hh1', 1);
  for (let i = 0; i < HOUSE_MEMORY_MAX_FACTS + 5; i += 1) {
    mem = mergeFact(
      mem,
      { kind: 'note', subject: `s${i}`, text: `fact ${i}`, source: 'inferred' },
      i + 2
    );
  }
  assert.equal(mem.facts.length, HOUSE_MEMORY_MAX_FACTS);
});

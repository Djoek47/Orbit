/**
 * Run: npx tsx lib/household/presence-transitions.test.ts
 */
import assert from 'node:assert/strict';

import {
  diffPresenceTransitions,
  presenceSnapshot,
  presenceTransitionCopy,
} from '@/lib/household/presence-transitions';
import type { HouseholdMember } from '@/types/orbit';

function child(partial: Partial<HouseholdMember> & Pick<HouseholdMember, 'id' | 'name'>): HouseholdMember {
  return {
    role: 'child',
    status: 'active',
    avatar: 'E',
    xp: 0,
    weekXp: 0,
    streak: 0,
    loadShare: 0,
    ...partial,
  };
}

const emmaLive = child({
  id: 'emma',
  name: 'Emma',
  lastSeenAt: new Date().toISOString(),
});
const emmaAway = child({
  id: 'emma',
  name: 'Emma',
  lastSeenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
});
const jackAwaiting = child({
  id: 'jack',
  name: 'Jack',
  lastSeenAt: null,
  status: 'invited',
});

const prev = presenceSnapshot([emmaLive, jackAwaiting]);
const next = presenceSnapshot([emmaAway, jackAwaiting]);
const transitions = diffPresenceTransitions(prev, next, [emmaAway, jackAwaiting]);

assert.equal(transitions.length, 1);
assert.equal(transitions[0]!.memberId, 'emma');
assert.equal(transitions[0]!.from, 'live');
assert.equal(transitions[0]!.to, 'away');

const copy = presenceTransitionCopy(transitions[0]!);
assert.match(copy.title, /disconnected/i);

assert.deepEqual(diffPresenceTransitions({}, next, [emmaAway]), []);

console.log('presence-transitions: ok');

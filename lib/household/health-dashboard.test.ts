/**
 * Live member load + cleaning-by-room for Household Health.
 * Run: npx --yes tsx lib/household/health-dashboard.test.ts
 */
import assert from 'node:assert/strict';

import {
  computeCleaningByRoom,
  computeLiveMemberLoad,
  healthLoadMembers,
  resolveHealthRooms,
} from './health-dashboard';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const members: HouseholdMember[] = [
  {
    id: 'n',
    name: 'Nero',
    role: 'owner',
    status: 'active',
    avatar: 'N',
    xp: 95,
    weekXp: 40,
    loadShare: 0,
  },
  {
    id: 'e',
    name: 'Emma',
    role: 'child',
    status: 'active',
    avatar: 'E',
    xp: 30,
    weekXp: 20,
    loadShare: 0,
  },
  {
    id: 'j',
    name: 'Jack',
    role: 'child',
    status: 'active',
    avatar: 'J',
    xp: 30,
    weekXp: 10,
    loadShare: 0,
  },
  {
    id: 'd',
    name: 'Kitchen iPad',
    role: 'shared-device',
    status: 'active',
    avatar: '📱',
    xp: 0,
    weekXp: 0,
    loadShare: 0,
  },
];

const tasks: HouseholdTask[] = [
  {
    id: 't1',
    title: 'Dishes',
    category: 'Kitchen',
    status: 'Pending',
    assignee: 'Emma',
    due: 'Today',
    xp: 10,
    repeat: 'None',
  },
  {
    id: 't2',
    title: 'Vacuum living room',
    category: 'Cleaning',
    status: 'Pending',
    assignee: 'Jack',
    due: 'Today',
    xp: 10,
    repeat: 'None',
  },
  {
    id: 't3',
    title: 'Bins',
    category: 'Outdoor',
    status: 'Pending',
    assignees: ['Nero', 'Emma'],
    assignee: 'Nero',
    due: 'Today',
    xp: 10,
    repeat: 'None',
  },
  {
    id: 't4',
    title: 'Kitchen wipe',
    category: 'Clean',
    status: 'Completed',
    assignee: 'Nero',
    roomId: 'room-kitchen',
    due: 'Today',
    xp: 10,
    repeat: 'None',
  },
];

assert.equal(healthLoadMembers(members).length, 3, 'shared-device omitted from load');

const load = computeLiveMemberLoad(members, tasks);
assert.equal(load.length, 3);
const byName = Object.fromEntries(load.map((row) => [row.member.name, row.loadShare]));
assert.ok(byName.Emma! > 0, 'Emma has open load');
assert.ok(byName.Jack! > 0, 'Jack has open load');
assert.ok(byName.Nero! > 0, 'Nero shares bins');
assert.equal(
  load.reduce((sum, row) => sum + row.loadShare, 0),
  100,
  'shares sum to 100'
);
const emma = load.find((row) => row.member.name === 'Emma')!;
assert.equal(emma.openCount, 2, 'Emma dishes + shared bins = 2 open');

// Stale DB zeros must not win — live math overrides.
assert.equal(members.find((m) => m.name === 'Emma')!.loadShare, 0);

// No open tasks → weekXp weights still produce a live distribution.
const xpOnly = computeLiveMemberLoad(members, []);
assert.equal(
  xpOnly.reduce((sum, row) => sum + row.loadShare, 0),
  100,
  'xp fallback sums to 100'
);
assert.ok(
  xpOnly.find((row) => row.member.name === 'Nero')!.loadShare >
    xpOnly.find((row) => row.member.name === 'Jack')!.loadShare,
  'higher weekXp gets more share when idle'
);

const rooms = resolveHealthRooms([]);
assert.ok(rooms.length >= 6, 'defaults when household has no rooms');

const cleaning = computeCleaningByRoom(tasks, []);
const kitchen = cleaning.find((row) => row.room.kind === 'kitchen')!;
assert.ok(kitchen.completed >= 1, 'kitchen sees completed wipe');
assert.ok(kitchen.open >= 1, 'kitchen sees dishes');
const living = cleaning.find((row) => row.room.kind === 'living')!;
assert.ok(living.open >= 1, 'living room matches vacuum title');

console.log('health-dashboard: ok');

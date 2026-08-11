import assert from 'node:assert/strict';

import { executePoppinsTool, toolResultToMonitorAction } from './execute-poppins-tool';
import { buildPoppinsDeskBrief } from './household-context';
import { POPPINS_MAJORDOMO_SYSTEM, POPPINS_TOOL_DEFINITIONS } from './poppins-tools';
import type { HouseholdSnapshot, OrbitMetrics } from '@/types/orbit';

const household = {
  id: 'hh1',
  householdName: 'Test House',
  greetingName: 'Alex',
  tasks: [
    {
      id: 't1',
      title: 'Dishes',
      assignee: 'Sam',
      due: 'Overdue',
      status: 'Overdue',
      category: 'Kitchen',
      xp: 10,
    },
  ],
  groceries: [{ id: 'g1', name: 'Milk', category: 'Dairy', status: 'Missing' }],
  events: [
    {
      id: 'e1',
      title: 'Practice',
      date: new Date().toISOString().slice(0, 10),
      time: '4:00 PM',
      responsible: 'Sam',
      category: 'Family',
    },
  ],
  members: [
    {
      id: 'm1',
      name: 'Sam',
      role: 'child',
      status: 'active',
      avatar: 'S',
      xp: 40,
      weekXp: 10,
      streak: 2,
      loadShare: 40,
    },
    {
      id: 'm2',
      name: 'Alex',
      role: 'admin',
      status: 'active',
      avatar: 'A',
      xp: 120,
      weekXp: 80,
      streak: 5,
      loadShare: 60,
    },
  ],
  rewards: [],
  itineraries: [],
  places: [],
} as unknown as HouseholdSnapshot;

const metrics = {
  momentum: 55,
  openTasks: 1,
  taskCompletionRate: 0.5,
  groceryReadiness: 0.4,
  calendarCoverage: 0.6,
  upcomingEvents: 1,
} as unknown as OrbitMetrics;

assert.match(POPPINS_MAJORDOMO_SYSTEM, /Poppins/);
assert.match(POPPINS_MAJORDOMO_SYSTEM, /propose_plan/);
assert.equal(POPPINS_TOOL_DEFINITIONS.length, 9);

const desk = buildPoppinsDeskBrief(household, metrics);
assert.equal(desk.overdueCount, 1);
assert.ok(desk.xpSkew.gap >= 0);
assert.ok(Array.isArray(desk.next48hEvents));

const fairness = executePoppinsTool('assess_xp_fairness', {}, household, metrics);
assert.equal(fairness.gap, 70);
assert.ok(fairness.recommendation);

const plan = executePoppinsTool(
  'propose_plan',
  { title: 'Saturday park', detail: 'Playground then groceries', dayLabel: 'Saturday' },
  household,
  metrics
);
assert.ok(plan.planDraft);
const action = toolResultToMonitorAction('propose_plan', { title: 'Saturday park' }, plan);
assert.equal(action.kind, 'plan');
assert.equal(action.data?.href, '/create-itinerary');

const awayHouse = {
  ...household,
  members: household.members.map((m) =>
    m.name === 'Sam'
      ? {
          ...m,
          awayFrom: '2000-01-01',
          awayTo: '2099-01-01',
        }
      : m
  ),
} as HouseholdSnapshot;
const nudge = executePoppinsTool(
  'nudge_member',
  { memberName: 'Sam', reason: 'Dishes still open' },
  awayHouse,
  metrics
);
assert.equal(nudge.skipped, true);

console.log('poppins-craft tests passed');

import assert from 'node:assert/strict';

import { eventVisibleToMember, visibleEventsForMember } from '@/lib/calendar/plan-visibility';
import type { HouseholdEvent, HouseholdMember } from '@/types/orbit';

const emma: HouseholdMember = {
  id: 'child-1',
  name: 'Emma',
  role: 'child',
  status: 'active',
  avatar: '👧',
  xp: 0,
  loadShare: 0,
};

const sarah: HouseholdMember = {
  id: 'admin-1',
  name: 'Sarah',
  role: 'admin',
  status: 'active',
  avatar: '👩',
  xp: 0,
  loadShare: 0,
};

const targeted: HouseholdEvent = {
  id: 'e1',
  title: 'Dentist',
  category: 'Appointment',
  date: 'Today',
  time: '3:00 PM',
  location: 'Clinic',
  responsible: 'Emma',
  attendeeMemberIds: ['child-1'],
};

const privateEvent: HouseholdEvent = {
  id: 'e2',
  title: 'Parent meeting',
  category: 'School',
  date: 'Tomorrow',
  time: '7:00 PM',
  location: 'School',
  responsible: 'Sarah',
  attendeeMemberIds: ['admin-1'],
};

assert.equal(eventVisibleToMember(targeted, emma), true);
assert.equal(eventVisibleToMember(privateEvent, emma), false);
assert.equal(visibleEventsForMember([targeted, privateEvent], sarah).length, 2);
assert.equal(visibleEventsForMember([targeted, privateEvent], emma).length, 1);

console.log('plan-visibility: ok');

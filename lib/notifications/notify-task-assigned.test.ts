import assert from 'node:assert/strict';

import { notifyTaskAssigned } from '@/lib/notifications/notify-task-assigned';
import type { HouseholdMember, HouseholdSnapshot, HouseholdTask } from '@/types/orbit';

const members: HouseholdMember[] = [
  { id: 'child-1', name: 'Emma', role: 'child', status: 'active', avatar: '👧', xp: 0, loadShare: 0 },
  { id: 'admin-1', name: 'Sarah', role: 'admin', status: 'active', avatar: '👩', xp: 0, loadShare: 0 },
];

const snapshot: Pick<HouseholdSnapshot, 'members' | 'notificationPrefs'> = {
  members,
  notificationPrefs: { tasks: true } as HouseholdSnapshot['notificationPrefs'],
};

const task: HouseholdTask = {
  id: 'task-1',
  title: 'Math worksheet',
  category: 'homework_education',
  assignee: 'Emma',
  due: 'Today',
  xp: 10,
  repeat: 'None',
  status: 'Pending',
};

const pushes: Array<Record<string, unknown>> = [];

void notifyTaskAssigned(
  async (input) => {
    pushes.push(input);
    return input;
  },
  snapshot,
  { title: task.title, category: task.category, assignee: 'Emma', due: 'Today', xp: 10, repeat: 'None' },
  task,
  true
).then(() => {
  assert.equal(pushes.length, 1);
  assert.equal((pushes[0]?.data as { audienceMemberIds?: string[] })?.audienceMemberIds?.[0], 'child-1');
  assert.equal((pushes[0]?.data as { kind?: string })?.kind, 'task_assigned');
  console.log('notify-task-assigned: ok');
});

/**
 * Run: npx --yes tsx lib/notifications/sidekick-announce.test.ts
 */
import assert from 'node:assert/strict';

import {
  diffSidekickAnnouncements,
  shouldAnnounceSidekickDiff,
} from '@/lib/notifications/sidekick-announce';

const matchAll = () => true;

assert.equal(
  shouldAnnounceSidekickDiff({ announceRequested: true, announceReady: false }),
  false,
  'hydrate / first sync stays silent'
);
assert.equal(
  shouldAnnounceSidekickDiff({ announceRequested: true, announceReady: true }),
  true,
  'live sync after ready may announce'
);
assert.equal(
  shouldAnnounceSidekickDiff({ announceRequested: false, announceReady: true }),
  false
);

// Empty previous + not ready → no replay of historical tasks/inbox.
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: false,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    taskMatchesAssignee: matchAll,
    tasks: [
      {
        id: 't1',
        title: 'Take out the garbage',
        status: 'Pending',
        assignee: 'Emma',
        assignees: ['Emma'],
      },
      {
        id: 't2',
        title: 'Load the dishwasher',
        status: 'Pending',
        assignee: 'Emma',
        assignees: ['Emma'],
      },
    ],
    notifications: [
      {
        id: 'n1',
        title: 'Poppins · Tasks',
        body: 'Take out the garbage was added to your list.',
        isRead: false,
        category: 'tasks',
        data: { kind: 'task_assigned', taskId: 't1' },
      },
      {
        id: 'n2',
        title: 'Poppins · Tasks',
        body: 'Load the dishwasher was added to your list.',
        isRead: false,
        category: 'tasks',
        data: { kind: 'task_assigned', taskId: 't2' },
      },
    ],
  });
  assert.equal(banners.length, 0, 'sign-in must not rebroadcast history');
}

// Ready + real diff → announce new unread note once; skip duplicate task banner.
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(['t1']),
    previousNotificationIds: new Set(['n1']),
    memberName: 'Emma',
    targetMemberId: 'e1',
    taskMatchesAssignee: matchAll,
    tasks: [
      {
        id: 't1',
        title: 'Take out the garbage',
        status: 'Pending',
        assignee: 'Emma',
        assignees: ['Emma'],
      },
      {
        id: 't2',
        title: 'Load the dishwasher',
        status: 'Pending',
        assignee: 'Emma',
        assignees: ['Emma'],
      },
    ],
    notifications: [
      {
        id: 'n1',
        title: 'Poppins · Tasks',
        body: 'Take out the garbage was added to your list.',
        isRead: false,
        category: 'tasks',
        data: { kind: 'task_assigned', taskId: 't1' },
      },
      {
        id: 'n2',
        title: 'Poppins · Tasks',
        body: 'Load the dishwasher was added to your list.',
        isRead: false,
        category: 'tasks',
        data: { kind: 'task_assigned', taskId: 't2' },
      },
    ],
  });
  assert.equal(banners.length, 1);
  assert.equal(banners[0]!.key, 'note:n2');
  assert.match(banners[0]!.body, /dishwasher/i);
  assert.equal(banners[0]!.data.targetMemberId, 'e1');
}

// Ready + only a new task (no inbox row yet) → one task banner with canonical copy.
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    taskMatchesAssignee: matchAll,
    tasks: [
      {
        id: 't3',
        title: 'Make bed',
        status: 'Pending',
        assignee: 'Emma',
        assignees: ['Emma'],
      },
    ],
    notifications: [],
  });
  assert.equal(banners.length, 1);
  assert.equal(banners[0]!.title, 'Poppins · Tasks');
  assert.equal(banners[0]!.body, 'Make bed was added to your list.');
}

// Smart ON + 3 assignment notes → one digest (not three banners).
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    smartDelivery: true,
    taskMatchesAssignee: matchAll,
    tasks: [],
    notifications: [1, 2, 3].map((n) => ({
      id: `n${n}`,
      title: 'Poppins · Tasks',
      body: `Task ${n} was added to your list.`,
      isRead: false,
      category: 'tasks' as const,
      data: { kind: 'task_assigned', taskId: `t${n}` },
    })),
  });
  assert.equal(banners.length, 1, 'Smart rolls three into one digest');
  assert.match(banners[0]!.key, /^digest:tasks:/);
  assert.match(banners[0]!.body, /3 tasks are ready/i);
  assert.equal(banners[0]!.data.kind, 'smart_digest');
  assert.equal(banners[0]!.data.targetMemberId, 'e1');
}

// Ledger keys suppress reopen replay even with empty previous sets.
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    smartDelivery: true,
    announcedKeys: new Set(['note:n1', 'note:n2', 'note:n3']),
    taskMatchesAssignee: matchAll,
    tasks: [],
    notifications: [1, 2, 3].map((n) => ({
      id: `n${n}`,
      title: 'Poppins · Tasks',
      body: `Task ${n} was added to your list.`,
      isRead: false,
      category: 'tasks' as const,
      data: { kind: 'task_assigned', taskId: `t${n}` },
    })),
  });
  assert.equal(banners.length, 0, 'ledger blocks reopen flood');
}

// Dismissed notes never re-banner.
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    dismissedNotificationIds: new Set(['n1']),
    taskMatchesAssignee: matchAll,
    tasks: [],
    notifications: [
      {
        id: 'n1',
        title: 'Poppins · Tasks',
        body: 'Sweep was added to your list.',
        isRead: false,
        category: 'tasks',
        data: { kind: 'task_assigned', taskId: 't1' },
      },
    ],
  });
  assert.equal(banners.length, 0);
}

// Smart OFF keeps individuals (capped by limit).
{
  const banners = diffSidekickAnnouncements({
    announceRequested: true,
    announceReady: true,
    previousTaskIds: new Set(),
    previousNotificationIds: new Set(),
    memberName: 'Emma',
    targetMemberId: 'e1',
    smartDelivery: false,
    limit: 2,
    taskMatchesAssignee: matchAll,
    tasks: [],
    notifications: [1, 2, 3].map((n) => ({
      id: `n${n}`,
      title: 'Poppins · Tasks',
      body: `Task ${n} was added to your list.`,
      isRead: false,
      category: 'tasks' as const,
      data: { kind: 'task_assigned', taskId: `t${n}` },
    })),
  });
  assert.equal(banners.length, 2);
}

console.log('sidekick-announce: ok');

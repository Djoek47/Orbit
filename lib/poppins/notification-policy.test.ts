/**
 * Luna inbox policy — burst coalesce, EXAMPLE strip, Needs Action only for human decisions.
 * Run: npx --yes tsx lib/poppins/notification-policy.test.ts
 */

import assert from 'node:assert/strict';

import {
  coalesceFacts,
  foldGlanceNotifications,
  glanceCopy,
  laneForKind,
  parseComposerJson,
  type ComposeDecision,
  type HouseholdFact,
} from './notification-policy';
import { bucketNotification } from './notification-buckets';
import { copyContainsExample, displayTrophyName } from '@/lib/trophies/display-name';
import { EXAMPLE_TROPHY_DEFINITIONS } from '@/lib/trophies/seed-examples';
import type { NotificationItem } from '@/types/orbit';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

function fact(partial: Partial<HouseholdFact> & Pick<HouseholdFact, 'id' | 'kind'>): HouseholdFact {
  return {
    at: 1_000,
    memberId: 'nice',
    memberName: 'Nice',
    ...partial,
  };
}

{
  for (const def of EXAMPLE_TROPHY_DEFINITIONS) {
    assert.equal(copyContainsExample(def.name), false, def.id);
    assert.equal(copyContainsExample(def.description), false, def.id);
    assert.equal(displayTrophyName(`EXAMPLE: ${def.name}`), def.name);
  }
  pass('seed trophy names have no EXAMPLE');
}

{
  assert.equal(laneForKind('reward_requested'), 'interrupt');
  assert.equal(laneForKind('trophy_unlocked'), 'glance');
  assert.equal(laneForKind('task_completed'), 'glance');
  assert.equal(laneForKind('nudge'), 'activity_only');
  assert.equal(laneForKind('deals'), 'activity_only');
  pass('lanes: interrupt vs glance vs activity-only');
}

{
  const facts: HouseholdFact[] = [
    fact({
      id: 'f1',
      kind: 'task_completed',
      title: 'Load the dishwasher',
      xp: 7,
    }),
    fact({
      id: 'f2',
      kind: 'trophy_unlocked',
      trophyName: 'EXAMPLE: First Step',
    }),
    fact({
      id: 'f3',
      kind: 'trophy_unlocked',
      trophyName: 'EXAMPLE: On-Time Share',
    }),
    fact({
      id: 'f4',
      kind: 'reward_requested',
      title: 'new video game',
    }),
  ];
  const out = coalesceFacts(facts, { now: 5_000 });
  const inbox = out.filter((d) => d.decision === 'send' || d.decision === 'merge');
  assert.equal(inbox.length, 2, `expected 2 inbox rows, got ${inbox.length}`);
  const interrupt = inbox.find((d) => d.urgency === 'needs_action');
  const glance = inbox.find((d) => d.urgency === 'today');
  assert.ok(interrupt, 'reward ask is Needs Action');
  assert.ok(glance, 'celebrations coalesce to Today');
  assert.match(interrupt!.body, /video game/i);
  assert.match(glance!.body, /dishwasher/i);
  assert.match(glance!.body, /First Step/);
  assert.match(glance!.body, /On-Time Share/);
  assert.equal(copyContainsExample(glance!.title + glance!.body), false);
  assert.equal(copyContainsExample(interrupt!.title + interrupt!.body), false);
  const celebrationBanners = inbox.filter((d) => d.banner && d.urgency !== 'needs_action');
  assert.equal(celebrationBanners.length, 1, 'one banner max for the celebration');
  pass('burst: 1 completion + 2 trophies + 1 ask → 2 inbox rows');
}

{
  const first = coalesceFacts(
    [fact({ id: 'a', kind: 'task_completed', title: 'Load the dishwasher', xp: 7 })],
    { now: 0 }
  );
  assert.equal(first[0]?.decision, 'send');
  const second = coalesceFacts(
    [fact({ id: 'b', kind: 'trophy_unlocked', trophyName: 'First Step' })],
    {
      now: 1_000,
      existing: [
        {
          kind: 'glance',
          urgency: 'today',
          createdAt: new Date(0).toISOString(),
          mergeKey: first[0]!.mergeKey,
          isRead: false,
        },
      ],
    }
  );
  assert.equal(second[0]?.decision, 'merge');
  assert.equal(second[0]?.mergeKey, first[0]?.mergeKey);
  pass('merge-id updates an existing glance card');
}

{
  const trophy: NotificationItem = {
    id: 'n-t',
    householdId: 'hh',
    title: 'Poppins · Trophy',
    body: 'Trophy unlocked: EXAMPLE: On-Time Share.',
    category: 'rewards',
    priority: 'medium',
    isRead: false,
    createdAt: new Date().toISOString(),
    data: { kind: 'trophy_unlocked', name: 'Nice' },
  };
  assert.notEqual(bucketNotification(trophy), 'critical', 'unread trophy is not Needs Action');
  pass('unread trophy is not critical');
}

{
  const fallback: ComposeDecision = {
    decision: 'send',
    urgency: 'today',
    title: 'Poppins',
    body: 'Nice finished Load the dishwasher.',
    category: 'ai',
    priority: 'medium',
    kind: 'glance',
    factIds: ['f1'],
    banner: true,
  };
  const parsed = parseComposerJson(
    '{"title":"Poppins","body":"Nice finished Load the dishwasher and earned First Step."}',
    fallback
  );
  assert.equal(parsed.body.includes('First Step'), true);
  const stripped = parseComposerJson(
    { title: 'Poppins', body: 'Trophy unlocked: EXAMPLE: First Step.' },
    fallback
  );
  assert.equal(copyContainsExample(stripped.body), false);
  pass('composer JSON parse + EXAMPLE strip');
}

{
  const copy = glanceCopy([
    fact({ id: '1', kind: 'trophy_unlocked', trophyName: 'EXAMPLE: First Step' }),
  ]);
  assert.equal(copyContainsExample(copy.body), false);
  assert.match(copy.body, /First Step/);
  pass('glance copy strips EXAMPLE');
}

{
  const now = Date.now();
  const items: NotificationItem[] = [
    {
      id: 'a',
      householdId: 'hh',
      title: 'Poppins · Tasks',
      body: 'Nice completed load the dishwasher. +7 XP.',
      category: 'ai',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(now).toISOString(),
      data: { kind: 'task_completed', name: 'Nice', task: 'Load the dishwasher', xp: 7 },
    },
    {
      id: 'b',
      householdId: 'hh',
      title: 'Poppins · Trophy',
      body: 'Trophy unlocked: EXAMPLE: First Step.',
      category: 'rewards',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(now + 1000).toISOString(),
      data: { kind: 'trophy_unlocked', name: 'Nice', trophy: 'EXAMPLE: First Step' },
    },
  ];
  const folded = foldGlanceNotifications(items, now);
  assert.equal(folded.length, 1);
  assert.equal(copyContainsExample(folded[0]!.body), false);
  pass('display fold merges glance spam and strips EXAMPLE');
}

console.log('\nnotification-policy tests passed');

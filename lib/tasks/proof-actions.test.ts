/**
 * Proof-loop unit tests — `npx tsx lib/tasks/proof-actions.test.ts`
 */

import {
  autoConfirmUnreviewed,
  confirmTaskVerification,
  markTaskNotDone,
  requestAnotherProofOnTask,
  resubmitProofPhoto,
} from '@/lib/tasks/proof-actions';
import type { HouseholdTask } from '@/types/orbit';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function base(partial: Partial<HouseholdTask> = {}): HouseholdTask {
  return {
    id: 't1',
    title: 'Wipe counters',
    category: 'kitchen_dining',
    assignee: 'Emma',
    due: 'Today',
    xp: 10,
    awardedXp: 10,
    repeat: 'Daily',
    status: 'Completed',
    completedAt: new Date().toISOString(),
    verification: 'unreviewed',
    proofRequired: true,
    proofRounds: [],
    proofPhotoUrls: [],
    ...partial,
  };
}

const confirmed = confirmTaskVerification(base(), 'admin-1');
assert(confirmed.ok && confirmed.task.verification === 'confirmed', 'confirm');

const ask1 = requestAnotherProofOnTask(base(), 'admin-1', 'Get the corner');
assert(ask1.ok && ask1.task.verification === 'proof_requested', 'ask photo');
assert((ask1.ok && ask1.task.proofRounds?.length) === 1, 'one round');

let task = ask1.ok ? ask1.task : base();
for (let i = 0; i < 3; i++) {
  const next = requestAnotherProofOnTask(
    { ...task, verification: 'unreviewed' },
    'admin-1',
    `round ${i + 2}`
  );
  if (next.ok) task = next.task;
}
const capped = requestAnotherProofOnTask(
  { ...task, verification: 'unreviewed', proofRounds: task.proofRounds },
  'admin-1'
);
assert(!capped.ok, 'cap at 3 rounds');

const reversed = markTaskNotDone(base({ awardedXp: 15 }));
assert(reversed.ok && reversed.reversedXp === 15, 'reverse xp');
assert(reversed.ok && reversed.task.status === 'Pending', 'back to pending');

const old = markTaskNotDone(
  base({
    completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  })
);
assert(!old.ok, 'locked after 7 days');

const resub = resubmitProofPhoto(base({ verification: 'proof_requested' }), 'file://photo2.jpg');
assert(resub.verification === 'unreviewed', 'resubmit → unreviewed');
assert(Boolean(resub.proofPhotoUrls?.includes('file://photo2.jpg')), 'photo appended');

const aged = new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString();
const auto = autoConfirmUnreviewed([base({ completedAt: aged, verification: 'unreviewed' })]);
assert(auto[0].verification === 'confirmed', '72h auto-confirm');

console.log('test:proof-actions OK');

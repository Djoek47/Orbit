/**
 * Proof-loop transitions (§1.7) — pure helpers for store actions.
 */

import {
  PROOF_ROUND_CAP,
  canMarkNotDone,
  canRequestAnotherProof,
  shouldAutoConfirm,
  type ProofRound,
  type TaskVerification,
} from '@/lib/tasks/verification';
import { isLateWindow } from '@/lib/tasks/occurrence-status';
import type { HouseholdTask } from '@/types/orbit';

export type ProofActionResult =
  | { ok: true; task: HouseholdTask; reversedXp?: number }
  | { ok: false; reason: string };

export function confirmTaskVerification(
  task: HouseholdTask,
  actorId: string,
  now = new Date()
): ProofActionResult {
  if (task.status !== 'Completed') {
    return { ok: false, reason: 'Task is not completed.' };
  }
  if (task.verification !== 'unreviewed' && task.verification !== 'proof_requested') {
    return { ok: false, reason: 'Nothing to confirm.' };
  }
  return {
    ok: true,
    task: {
      ...task,
      verification: 'confirmed',
      verifiedBy: actorId,
      verifiedAt: now.toISOString(),
      proofStatus: 'approved',
    },
  };
}

export function requestAnotherProofOnTask(
  task: HouseholdTask,
  actorId: string,
  note?: string,
  now = new Date()
): ProofActionResult {
  if (task.status !== 'Completed') {
    return { ok: false, reason: 'Task is not completed.' };
  }
  const rounds = task.proofRounds ?? [];
  const verification = (task.verification ?? 'unreviewed') as TaskVerification;
  if (!canRequestAnotherProof(verification, rounds)) {
    return {
      ok: false,
      reason:
        rounds.length >= PROOF_ROUND_CAP
          ? 'Proof round limit reached. Confirm or mark not done.'
          : 'Cannot request more proof.',
    };
  }
  const nextRound: ProofRound = {
    note: note?.trim() || undefined,
    requestedAt: now.toISOString(),
    requestedByMemberId: actorId,
  };
  return {
    ok: true,
    task: {
      ...task,
      // Revision C §1: on-demand proof may start from chores that never had a create-time flag.
      proofRequired: true,
      verification: 'proof_requested',
      proofRounds: [...rounds, nextRound],
      proofStatus: 'none',
    },
  };
}

export function markTaskNotDone(task: HouseholdTask, now = new Date()): ProofActionResult {
  if (task.status !== 'Completed') {
    return { ok: false, reason: 'Task is not completed.' };
  }
  if (!canMarkNotDone(task.completedAt, now)) {
    return { ok: false, reason: 'Reversal window closed (7 days).' };
  }
  const reversedXp = task.awardedXp ?? 0;
  let nextStatus: HouseholdTask['status'] = 'Pending';
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (due.getTime() < now.getTime()) {
      nextStatus = isLateWindow(task.dueAt, now) ? 'Overdue' : 'Missed';
    }
  }

  return {
    ok: true,
    reversedXp,
    task: {
      ...task,
      status: nextStatus,
      verification: 'rejected',
      awardedXp: 0,
      completedAt: undefined,
      completedLate: false,
      latenessMinutes: undefined,
      proofStatus: task.proofRequired ? 'none' : undefined,
    },
  };
}

export function autoConfirmUnreviewed(tasks: HouseholdTask[], now = new Date()): HouseholdTask[] {
  return tasks.map((task) => {
    if (
      task.status === 'Completed' &&
      shouldAutoConfirm(task.verification ?? 'not_required', task.completedAt, now)
    ) {
      return {
        ...task,
        verification: 'confirmed' as const,
        verifiedAt: now.toISOString(),
        proofStatus: 'approved' as const,
      };
    }
    return task;
  });
}

export function resubmitProofPhoto(task: HouseholdTask, proofUri: string): HouseholdTask {
  const urls = [...(task.proofPhotoUrls ?? [])];
  if (task.proofUri && !urls.includes(task.proofUri)) urls.unshift(task.proofUri);
  if (!urls.includes(proofUri)) urls.push(proofUri);
  return {
    ...task,
    proofUri,
    proofPhotoUrls: urls,
    verification: 'unreviewed',
    proofStatus: 'submitted',
  };
}

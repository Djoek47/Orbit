import { isHomeworkCategory } from '@/lib/tasks/homework-subject';
import { canMarkNotDone } from '@/lib/tasks/verification';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const PROOF_REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isSidekickMember(member: HouseholdMember | null | undefined): boolean {
  return member?.role === 'child';
}

function withinProofRequestWindow(task: HouseholdTask, now = new Date()): boolean {
  if (!task.completedAt) return false;
  const completedMs = new Date(task.completedAt).getTime();
  if (Number.isNaN(completedMs)) return false;
  return now.getTime() - completedMs <= PROOF_REQUEST_WINDOW_MS;
}

/** Admin may ask for photo on a completed chore done by a Sidekick — Rev C §1.1. */
export function canAdminRequestTaskProof(
  task: HouseholdTask,
  assigneeMember: HouseholdMember | null | undefined,
  now = new Date()
): boolean {
  if (task.status !== 'Completed') return false;
  if (isHomeworkCategory(task.category, task.title)) return false;
  if (!isSidekickMember(assigneeMember)) return false;
  if (!withinProofRequestWindow(task, now)) return false;
  return canMarkNotDone(task.completedAt, now);
}

export function canAdminReviewCompletedProof(task: HouseholdTask): boolean {
  return (
    task.status === 'Completed' &&
    (task.verification === 'unreviewed' ||
      task.verification === 'proof_requested' ||
      task.proofStatus === 'submitted')
  );
}

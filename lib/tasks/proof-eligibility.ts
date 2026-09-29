import { isHomeworkCategory } from '@/lib/tasks/homework-subject';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { canRequestAnotherProof, type TaskVerification } from '@/lib/tasks/verification';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

const PROOF_REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function withinProofRequestWindow(task: HouseholdTask, now = new Date()): boolean {
  // Older completes never wrote completed_at. A missing stamp is still inside the window.
  if (!task.completedAt) return true;
  const completedMs = new Date(task.completedAt).getTime();
  if (Number.isNaN(completedMs)) return true;
  return now.getTime() - completedMs <= PROOF_REQUEST_WINDOW_MS;
}

/**
 * Sidekick still owes a photo after an admin asked.
 * The chore stays Completed; this is only the visual / reply state.
 */
export function needsSidekickPhotoReply(task: HouseholdTask): boolean {
  return (
    task.status === 'Completed' &&
    task.verification === 'proof_requested' &&
    task.proofStatus !== 'submitted' &&
    task.proofStatus !== 'approved'
  );
}

/** Admin may ask for a photo on a completed chore done by a Sidekick — Rev C §1.1. */
export function canAdminRequestTaskProof(
  task: HouseholdTask,
  assigneeMember: HouseholdMember | null | undefined,
  now = new Date()
): boolean {
  if (task.status !== 'Completed') return false;
  // Homework too: a parent can ask for a photo of finished homework, same as a chore.
  if (!isSidekickRole(assigneeMember?.role)) return false;
  if (!withinProofRequestWindow(task, now)) return false;
  const verification = (task.verification ?? 'not_required') as TaskVerification;
  return canRequestAnotherProof(verification, task.proofRounds ?? []);
}

export function canAdminReviewCompletedProof(task: HouseholdTask): boolean {
  return (
    task.status === 'Completed' &&
    (task.verification === 'unreviewed' ||
      task.verification === 'proof_requested' ||
      task.proofStatus === 'submitted')
  );
}

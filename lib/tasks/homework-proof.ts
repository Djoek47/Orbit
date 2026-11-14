import { isHomeworkCategory } from '@/lib/tasks/homework-subject';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

/** Per-child homework proof default — Rev C §1.2. */
export function memberHomeworkProofRequired(member: HouseholdMember | null | undefined): boolean {
  return member?.homeworkProofRequired !== false;
}

/** Whether a newly assigned homework task should require photo proof. */
export function proofRequiredForHomeworkAssign(
  category: string,
  assigneeMember: HouseholdMember | null | undefined
): boolean {
  if (!isHomeworkCategory(category)) return false;
  return memberHomeworkProofRequired(assigneeMember);
}

/** Whether completing this task should prompt for photo proof. */
export function needsProofOnComplete(
  task: HouseholdTask,
  assigneeMember: HouseholdMember | null | undefined
): boolean {
  // Per-task flag wins — baked at assign / Edit (homework defaults from member setting).
  if (typeof task.proofRequired === 'boolean') {
    return task.proofRequired;
  }
  if (isHomeworkCategory(task.category, task.title)) {
    return memberHomeworkProofRequired(assigneeMember);
  }
  return false;
}

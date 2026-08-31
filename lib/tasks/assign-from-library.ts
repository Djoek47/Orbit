import { formatLocalDate } from '@/lib/streaks/local-date';
import { formatHomeworkDescription } from '@/lib/tasks/homework-subject';
import { proofRequiredForHomeworkAssign } from '@/lib/tasks/homework-proof';
import { libraryDefinitionId } from '@/lib/tasks/due-label';
import { mapLibraryRepeat } from '@/lib/tasks/library-repeat';
import { dueAtForFrequency, DEFAULT_DUE_TIME_LOCAL } from '@/lib/tasks/recurrence-defaults';
import type { Frequency, LibraryTask } from '@/lib/tasks/task-library';
import type { CreateTaskInput, HouseholdMember } from '@/types/orbit';

export type LibraryAssignOptions = {
  now?: Date;
  dueTimeLocal?: string;
  dueLabel?: string;
  occurrenceDate?: string;
  dueAt?: string;
  homeworkSubject?: string;
  assigneeMember?: HouseholdMember | null;
};

/**
 * First occurrence of a freshly assigned library task is always today.
 * Frequency only sets the repeat rule — using dueAtForFrequency(weekly|monthly)
 * as the first due hid new tasks from Today/Active (they landed next Sunday).
 */
export function buildLibraryAssignInput(
  task: LibraryTask,
  assigneeName: string,
  frequency: Frequency,
  optionsOrNow: LibraryAssignOptions | Date = {},
  dueTimeLocalLegacy?: string
): CreateTaskInput {
  const options: LibraryAssignOptions =
    optionsOrNow instanceof Date
      ? { now: optionsOrNow, dueTimeLocal: dueTimeLocalLegacy }
      : optionsOrNow;
  const now = options.now ?? new Date();
  const dueTimeLocal = options.dueTimeLocal ?? DEFAULT_DUE_TIME_LOCAL;
  const occurrenceDate = options.occurrenceDate ?? formatLocalDate(now);
  const dueAt = options.dueAt ?? dueAtForFrequency('daily', now, dueTimeLocal)?.toISOString();
  const homeworkSubject = options.homeworkSubject?.trim() || undefined;
  const isHomework = task.domainId === 'homework_education';

  return {
    title: task.name,
    category: task.domainId,
    assignee: assigneeName,
    due: options.dueLabel ?? 'Today',
    dueAt,
    xp: task.xp,
    baseXp: task.xp,
    xpEligible: task.tracking === 'xp',
    tracking: task.tracking,
    repeat: mapLibraryRepeat(frequency),
    difficulty: 'medium',
    weight: 1,
    proofRequired: isHomework
      ? proofRequiredForHomeworkAssign(task.domainId, options.assigneeMember ?? null)
      : false,
    homeworkSubject,
    description: isHomework ? formatHomeworkDescription(homeworkSubject) : undefined,
    definitionId: libraryDefinitionId(task.id, assigneeName),
    occurrenceDate,
  };
}

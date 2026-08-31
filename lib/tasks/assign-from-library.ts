import { formatLocalDate } from '@/lib/streaks/local-date';
import { libraryDefinitionId } from '@/lib/tasks/due-label';
import { mapLibraryRepeat } from '@/lib/tasks/library-repeat';
import { dueAtForFrequency, DEFAULT_DUE_TIME_LOCAL } from '@/lib/tasks/recurrence-defaults';
import type { Frequency, LibraryTask } from '@/lib/tasks/task-library';
import type { CreateTaskInput } from '@/types/orbit';

/**
 * First occurrence of a freshly assigned library task is always today.
 * Frequency only sets the repeat rule — using dueAtForFrequency(weekly|monthly)
 * as the first due hid new tasks from Today/Active (they landed next Sunday).
 */
export function buildLibraryAssignInput(
  task: LibraryTask,
  assigneeName: string,
  frequency: Frequency,
  now = new Date(),
  dueTimeLocal = DEFAULT_DUE_TIME_LOCAL
): CreateTaskInput {
  const occurrenceDate = formatLocalDate(now);
  const dueAt = dueAtForFrequency('daily', now, dueTimeLocal);
  return {
    title: task.name,
    category: task.domainId,
    assignee: assigneeName,
    due: 'Today',
    dueAt: dueAt?.toISOString(),
    xp: task.xp,
    baseXp: task.xp,
    xpEligible: task.tracking === 'xp',
    tracking: task.tracking,
    repeat: mapLibraryRepeat(frequency),
    difficulty: 'medium',
    weight: 1,
    proofRequired: task.domainId === 'homework_education',
    definitionId: libraryDefinitionId(task.id, assigneeName),
    occurrenceDate,
  };
}

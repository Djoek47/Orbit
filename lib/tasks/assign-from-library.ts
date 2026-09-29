import { formatHomeworkDescription } from '@/lib/tasks/homework-subject';
import { proofRequiredForHomeworkAssign } from '@/lib/tasks/homework-proof';
import { libraryDefinitionId } from '@/lib/tasks/due-label';
import { resolveAssignOccurrence } from '@/lib/tasks/assign-occurrence';
import { mapLibraryRepeat } from '@/lib/tasks/library-repeat';
import { DEFAULT_DUE_TIME_LOCAL } from '@/lib/tasks/recurrence-defaults';
import type { Frequency, LibraryTask } from '@/lib/tasks/task-library';
import type { CreateTaskInput, HouseholdMember } from '@/types/orbit';

export type LibraryAssignOptions = {
  now?: Date;
  dueTimeLocal?: string;
  /** Household daily deadline HH:MM — when past, first occurrence is tomorrow. */
  dailyDeadlineHm?: string;
  timezone?: string | null;
  dueLabel?: string;
  occurrenceDate?: string;
  dueAt?: string;
  homeworkSubject?: string;
  assigneeMember?: HouseholdMember | null;
};

/**
 * First occurrence is today before the daily deadline, tomorrow after.
 * Frequency only sets the repeat rule — never parks a fresh assign on next Sunday.
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
  const dailyDeadlineHm = options.dailyDeadlineHm ?? dueTimeLocal;
  const resolved =
    options.occurrenceDate && options.dueLabel
      ? {
          occurrenceDate: options.occurrenceDate,
          dueLabel: options.dueLabel,
          dueAt: options.dueAt,
          rolledToTomorrow: false,
        }
      : resolveAssignOccurrence({
          now,
          dailyDeadlineHm,
          dueTimeLocal,
          timezone: options.timezone,
        });
  const occurrenceDate = options.occurrenceDate ?? resolved.occurrenceDate;
  const dueAt = options.dueAt ?? resolved.dueAt;
  const dueLabel = options.dueLabel ?? resolved.dueLabel;
  const homeworkSubject = options.homeworkSubject?.trim() || undefined;
  const isHomework = task.domainId === 'homework_education';

  return {
    title: task.name,
    category: task.domainId,
    assignee: assigneeName,
    due: dueLabel,
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

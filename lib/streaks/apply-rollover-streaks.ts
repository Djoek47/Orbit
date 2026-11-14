/**
 * Wire Revision D day classification into production rollover.
 * After a local day has been expired/carried, classify each member and
 * apply cliffs / Rescue offers via the streak engine.
 */
import { countsTowardDailyStreak } from '@/lib/scoring/counts-toward-daily-streak';
import { classifyDay, type QualifyingOccurrence } from '@/lib/scoring/classify-day';
import { applyMemberDayClass, ensureMemberStreak } from '@/lib/streaks/mock-streak-store';
import { isExpiredStatus } from '@/lib/tasks/recurring';
import { taskMatchesAssignee } from '@/lib/tasks/split-assign';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

function occurrenceStatus(task: HouseholdTask): QualifyingOccurrence['status'] {
  if (task.status === 'Completed') return 'completed';
  if (isExpiredStatus(task.status)) return 'expired';
  if (task.status === 'Overdue') return 'late';
  return 'pending';
}

export function weekToDateGrossXp(
  tasks: HouseholdTask[],
  memberName: string,
  localDate: string
): number {
  // Rough week window: Mon–Sun containing localDate (ISO week-ish via date math).
  const [y, m, d] = localDate.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = anchor.getUTCDay(); // 0 Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const startKey = monday.toISOString().slice(0, 10);
  const endKey = sunday.toISOString().slice(0, 10);

  let sum = 0;
  for (const task of tasks) {
    if (!taskMatchesAssignee(task, memberName)) continue;
    if (task.status !== 'Completed') continue;
    const key = task.occurrenceDate || (task.completedAt ? task.completedAt.slice(0, 10) : '');
    if (!key || key < startKey || key > endKey) continue;
    sum += task.awardedXp ?? task.xp ?? 0;
  }
  return sum;
}

export type RolloverStreakResult = {
  memberId: string;
  dayClass: ReturnType<typeof classifyDay>;
  streak: number;
  pendingRescue: boolean;
};

/**
 * Classify `localDate` for each active non-shared-device member and update the engine.
 * Returns streak numbers to sync onto household.members.
 */
export function applyRolloverStreaksForDay(input: {
  localDate: string;
  members: HouseholdMember[];
  tasks: HouseholdTask[];
  recessMemberNames?: Set<string>;
}): RolloverStreakResult[] {
  const results: RolloverStreakResult[] = [];
  const recess = input.recessMemberNames ?? new Set<string>();

  for (const member of input.members) {
    if (member.status !== 'active') continue;
    if (member.role === 'shared-device') continue;

    ensureMemberStreak(member.id);

    const dayTasks = input.tasks.filter(
      (task) =>
        taskMatchesAssignee(task, member.name) &&
        (task.occurrenceDate === input.localDate ||
          (task.expiredAt && task.expiredAt.slice(0, 10) === input.localDate) ||
          (task.completedAt && task.completedAt.slice(0, 10) === input.localDate))
    );

    const occurrences: QualifyingOccurrence[] = dayTasks.map((task) => ({
      status: occurrenceStatus(task),
      frequency: task.repeat,
      repeat: task.repeat,
      tracking: task.tracking,
      category: task.category,
      onRecess: recess.has(member.name),
    }));

    // Drop non-qualifying (hygiene B / weekly) before classify — classifyDay also filters.
    void countsTowardDailyStreak;

    const dayClass = classifyDay({
      onRecess: recess.has(member.name),
      occurrences,
    });

    const gross = weekToDateGrossXp(input.tasks, member.name, input.localDate);
    const streak = applyMemberDayClass(member.id, dayClass, input.localDate, gross);
    ensureMemberStreak(member.id);

    results.push({
      memberId: member.id,
      dayClass,
      streak: streak.current,
      pendingRescue: Boolean(streak.pendingRescue),
    });
  }

  return results;
}

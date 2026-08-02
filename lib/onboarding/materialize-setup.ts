/**
 * Apply a setup draft onto a freshly created household (members, tasks, rewards).
 */

import type { DraftMember, HouseholdSetupDraft } from '@/lib/onboarding/setup-draft';
import { allLibraryTasks } from '@/lib/tasks/task-library';
import { dueAtForFrequency } from '@/lib/tasks/recurrence-defaults';
import type { CreateRewardInput, CreateTaskInput, HouseholdTask } from '@/types/orbit';

function mapFrequency(freq: string): HouseholdTask['repeat'] {
  switch (freq) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly':
    case '2x_weekly':
    case 'biweekly':
      return 'Weekly';
    default:
      return 'None';
  }
}

export function tasksFromDraftMember(member: DraftMember): CreateTaskInput[] {
  const library = allLibraryTasks();
  const byId = new Map(library.map((t) => [t.id, t]));
  return member.taskLibraryIds
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((task) => {
      const dueAt = dueAtForFrequency(task.defaultFrequency);
      return {
        title: task.name,
        category: task.domainId,
        assignee: member.name.trim(),
        due: dueAt ? 'Today' : 'As needed',
        dueAt: dueAt?.toISOString(),
        xp: task.xp,
        baseXp: task.xp,
        xpEligible: task.tracking === 'xp',
        tracking: task.tracking,
        repeat: mapFrequency(task.defaultFrequency),
      } satisfies CreateTaskInput;
    });
}

export function rewardsFromDraftMember(member: DraftMember): CreateRewardInput[] {
  return member.rewards.map((reward) => ({
    title: reward.quantity ? `${reward.title} (${reward.quantity})` : reward.title,
    cost: 0,
    approvalRequired: true,
    category: 'Privilege',
    assignedMemberName: member.name.trim(),
    frequency: reward.frequency,
    quantity: reward.quantity,
    presetId: reward.presetId,
    origin: 'minted' as const,
  }));
}

export function incompleteMemberCount(draft: HouseholdSetupDraft): number {
  return draft.members.filter((m) => m.name.trim() && !m.setupComplete).length;
}

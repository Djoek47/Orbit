/**
 * Tasks picked during admin onboarding stay planned until the member connects.
 * Streaks and XP only start once they join on their device.
 */

import { tasksFromDraftMember } from '@/lib/onboarding/materialize-setup';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import type { RewardMode } from '@/lib/rewards/reward-mode';
import type { CreateTaskInput, HouseholdMember } from '@/types/orbit';

export function plannedTasksForMember(
  member: Pick<HouseholdMember, 'name' | 'plannedTaskLibraryIds'>,
  scoringMode: RewardMode = 'weighted'
): CreateTaskInput[] {
  const ids = member.plannedTaskLibraryIds ?? [];
  if (!ids.length || !member.name.trim()) return [];
  const draft: DraftMember = {
    id: 'planned',
    name: member.name.trim(),
    role: 'member',
    taskLibraryIds: ids,
    rewards: [],
    setupComplete: true,
  };
  return tasksFromDraftMember(draft, scoringMode);
}

export function plannedTaskCount(member: Pick<HouseholdMember, 'plannedTaskLibraryIds'>): number {
  return member.plannedTaskLibraryIds?.length ?? 0;
}

/**
 * Apply a setup draft onto a freshly created household (members, tasks, rewards).
 */

import type { DraftMember, HouseholdSetupDraft } from '@/lib/onboarding/setup-draft';
import {
  DEFAULT_REWARD_PACKAGE_ID,
  draftRewardsFromPackage,
} from '@/lib/rewards/reward-packages';
import { type RewardMode, resolveTaskXp } from '@/lib/rewards/reward-mode';
import { mapLibraryRepeat } from '@/lib/tasks/library-repeat';
import { dueAtForFrequency, DEFAULT_DUE_TIME_LOCAL } from '@/lib/tasks/recurrence-defaults';
import { allLibraryTasks, type Frequency } from '@/lib/tasks/task-library';
import type { CreateRewardInput, CreateTaskInput } from '@/types/orbit';

/**
 * Library → CreateTaskInput. Keeps intrinsic `baseXp`; snapshots display/award
 * `xp` for Equity (flat 10) so onboarding materialize matches Tasks.
 * Frequency comes from the Get Started picker when set, else library default.
 * First due is always today (same as assign-from-library) so weekly picks
 * are not hidden until next Sunday.
 */
export function tasksFromDraftMember(
  member: DraftMember,
  scoringMode: RewardMode = 'weighted'
): CreateTaskInput[] {
  const library = allLibraryTasks();
  const byId = new Map(library.map((t) => [t.id, t]));
  const mode = scoringMode === 'flat' ? 'flat' : 'weighted';
  const now = new Date();
  return member.taskLibraryIds
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((task) => {
      const frequency = (member.taskFrequencies?.[task.id] as Frequency | undefined) ??
        task.defaultFrequency;
      const dueAt = dueAtForFrequency('daily', now, DEFAULT_DUE_TIME_LOCAL);
      const xpEligible = task.tracking === 'xp';
      const baseXp = xpEligible ? task.xp : 0;
      const xp = resolveTaskXp(
        { baseXp, xpEligible },
        { mode, hygieneRewarded: false, hygieneXp: 5 }
      );
      return {
        title: task.name,
        category: task.domainId,
        assignee: member.name.trim(),
        due: dueAt ? 'Today' : 'As needed',
        dueAt: dueAt?.toISOString(),
        xp,
        baseXp,
        xpEligible,
        tracking: task.tracking,
        repeat: mapLibraryRepeat(frequency),
      } satisfies CreateTaskInput;
    });
}

export function rewardsFromDraftMember(
  member: DraftMember,
  fallbackPackageId: string | null | undefined = DEFAULT_REWARD_PACKAGE_ID
): CreateRewardInput[] {
  const source =
    member.rewards.length > 0
      ? member.rewards
      : draftRewardsFromPackage(fallbackPackageId ?? DEFAULT_REWARD_PACKAGE_ID);
  return source.map((reward) => ({
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

/** Predicates for conditional tour steps — Work Order 9 D3 / D5–D8. */

import { isAdminRole } from '@/lib/household/admins';
import { capabilitiesFor, type RewardModel } from '@/lib/rewards/reward-model';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { HouseholdMember, HouseholdSnapshot } from '@/types/orbit';
import type { TourId } from '@/lib/tour/tour-types';

export type TourConditionContext = {
  household: HouseholdSnapshot;
  currentMember?: HouseholdMember | null;
  hostKind?: 'sidekick' | 'shared-tablet' | null;
  /** First task in list requests photo proof. */
  firstTaskNeedsProof?: boolean;
  /** How many reward surface segments are visible. */
  rewardSegmentCount?: number;
  joinedViaInvite?: boolean;
};

export function resolveTourId(ctx: TourConditionContext): TourId {
  if (ctx.hostKind === 'shared-tablet' && isSidekickRole(ctx.currentMember?.role)) {
    return 'sidekick';
  }
  if (isSidekickRole(ctx.currentMember?.role)) {
    return 'sidekick';
  }
  if (ctx.joinedViaInvite && ctx.currentMember?.role && isAdminRole(ctx.currentMember.role)) {
    return 'joined_adult';
  }
  return 'admin';
}

export function showRewards(household: HouseholdSnapshot): boolean {
  return capabilitiesFor(household.rewardModel as RewardModel | null | undefined).rewardsEnabled;
}

export function showAllowance(household: HouseholdSnapshot): boolean {
  return capabilitiesFor(household.rewardModel as RewardModel | null | undefined).allowanceEnabled;
}

export function showRanks(household: HouseholdSnapshot): boolean {
  return capabilitiesFor(household.rewardModel as RewardModel | null | undefined).xpEnabled;
}

export function isPadDevice(): boolean {
  try {
    // Lazy require so node tests can import this module without RN.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    return Platform.OS === 'ios' && Platform.isPad === true;
  } catch {
    return false;
  }
}

export function isSharedTabletHost(hostKind?: string | null): boolean {
  return hostKind === 'shared-tablet';
}

/**
 * Upgrade households must not auto-start the tour.
 * Heuristic: more than 3 tasks, or any known timestamp older than 2 days.
 */
export function isUpgradeHousehold(
  household: HouseholdSnapshot,
  opts?: { onboardingCompletedAt?: string | null }
): boolean {
  if ((household.tasks?.length ?? 0) > 3) return true;
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - twoDaysMs;
  const stamps: string[] = [];
  if (opts?.onboardingCompletedAt) stamps.push(opts.onboardingCompletedAt);
  for (const period of household.recessPeriods ?? []) {
    if (period.createdAt) stamps.push(period.createdAt);
  }
  for (const stamp of stamps) {
    const t = Date.parse(stamp);
    if (!Number.isNaN(t) && t < cutoff) return true;
  }
  return false;
}

export function evaluateTourWhen(when: string | undefined, ctx: TourConditionContext): boolean {
  if (!when) return true;
  switch (when) {
    case 'showRewards':
      return showRewards(ctx.household);
    case 'showAllowance':
      return showAllowance(ctx.household);
    case 'showRanks':
      return showRanks(ctx.household);
    case 'rewardSegmentsGte2':
      return (ctx.rewardSegmentCount ?? 0) >= 2;
    case 'firstTaskNeedsProof':
      return Boolean(ctx.firstTaskNeedsProof);
    case 'isPad':
      return isPadDevice();
    case 'sharedTablet':
      return isSharedTabletHost(ctx.hostKind);
    case 'homeworkEnabled':
      return ctx.household.homeworkEnabled !== false;
    default:
      return true;
  }
}

export function ownerName(household: HouseholdSnapshot): string {
  const owner =
    household.members.find((m) => m.role === 'owner') ??
    household.members.find((m) => m.role === 'admin');
  return owner?.name?.split(' ')[0] || 'Your household';
}

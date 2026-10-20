/**
 * Build the House Rules household view from the live snapshot.
 * Spec: docs/logic/CURSOR-SPEC-house-rules.md §6, §8.1, Appendix A.2
 */
import { effectiveDailyDeadline, settleDeadlineState } from '@/lib/rules/deadline';
import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import type { HouseRulesHouseholdView } from '@/lib/rules/types';
import type { HouseholdMember, HouseholdRole, HouseholdSnapshot } from '@/types/orbit';

/**
 * Persisted Sidekick role raw value is `child` — Appendix A.2.
 * Do not rename this storage token.
 */
export const SIDEKICK_ROLE_STORAGE = 'child' as const satisfies HouseholdRole;

export function countSidekicks(members: Pick<HouseholdMember, 'role' | 'status'>[]): number {
  return members.filter((m) => m.status === 'active' && m.role === SIDEKICK_ROLE_STORAGE).length;
}

export function isHouseRulesAdminRole(role: HouseholdRole | undefined | null): boolean {
  return role === 'owner' || role === 'admin';
}

/** Mode is a function of role. Sidekick sessions cannot hold Admin. */
export function houseRulesVoiceForRole(
  role: HouseholdRole | undefined | null,
  adminPreview: 'admin' | 'sidekick',
  modes: {
    admin: { switcherVisible: boolean; mayViewSidekickVersion: boolean; defaultVersion: 'admin' | 'sidekick' };
    sidekick: { switcherVisible: boolean; mayViewAdminVersion: boolean; defaultVersion: 'admin' | 'sidekick' };
  }
): 'admin' | 'sidekick' {
  if (!isHouseRulesAdminRole(role)) {
    return modes.sidekick.defaultVersion;
  }
  if (!modes.admin.switcherVisible || !modes.admin.mayViewSidekickVersion) {
    return modes.admin.defaultVersion;
  }
  return adminPreview;
}

export function prefers24hClock(): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h23' || cycle === 'h24';
  } catch {
    return false;
  }
}

export function houseRulesHouseholdView(
  household: Pick<
    HouseholdSnapshot,
    | 'rewardModel'
    | 'homeworkEnabled'
    | 'allowanceRequestsEnabled'
    | 'dailyDeadline'
    | 'dailyDeadlinePending'
    | 'dailyDeadlineAppliesOn'
    | 'members'
  >,
  now = new Date()
): HouseRulesHouseholdView {
  const doc = getHouseRulesDoc();
  const settled = settleDeadlineState(doc, household, now);
  return {
    rewardModel: household.rewardModel ?? 'full',
    sidekickCount: countSidekicks(household.members),
    homeworkEnabled: household.homeworkEnabled !== false,
    allowanceRequestsEnabled: household.allowanceRequestsEnabled !== false,
    dailyDeadline: settled.dailyDeadline,
    use24h: prefers24hClock(),
  };
}

export function householdDueTimeLocal(
  household: Pick<
    HouseholdSnapshot,
    'dailyDeadline' | 'dailyDeadlinePending' | 'dailyDeadlineAppliesOn'
  >,
  now = new Date()
): string {
  return effectiveDailyDeadline(getHouseRulesDoc(), household, now);
}

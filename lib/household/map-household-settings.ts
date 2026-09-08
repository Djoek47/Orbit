import { DEFAULT_MEMBER_CAPABILITIES } from '@/lib/member-capabilities';
import { DEFAULT_REWARD_MODEL, migrateLegacyRewardModel } from '@/lib/rewards/reward-model';
import type { HouseholdSnapshot, MemberCapabilities } from '@/types/orbit';

/** Raw households row shape from Supabase (subset used for settings sync). */
export type HouseholdSettingsRow = {
  id?: string;
  name?: string | null;
  reward_mode?: 'weighted' | 'flat' | string | null;
  reward_model?: string | null;
  hygiene_rewarded?: boolean | null;
  hygiene_xp?: number | null;
  daily_deadline?: string | null;
  daily_deadline_pending?: string | null;
  daily_deadline_applies_on?: string | null;
  allowance_requests_enabled?: boolean | null;
  join_approval_required?: boolean | null;
  sidekick_grocery_add?: boolean | null;
  member_capabilities?: Record<string, boolean> | null;
};

export type CustomHouseRuleRow = {
  id?: string;
  body?: string;
  sort_order?: number;
};

export function mapMemberCapabilitiesFromRow(
  raw: Record<string, boolean> | null | undefined
): MemberCapabilities | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    ...DEFAULT_MEMBER_CAPABILITIES,
    ...(raw as Partial<MemberCapabilities>),
  };
}

/** Map persisted household columns into snapshot settings fields. */
export function mapHouseholdSettingsFromRow(
  row: HouseholdSettingsRow | null | undefined
): Partial<HouseholdSnapshot> {
  if (!row) return {};

  return {
    id: row.id,
    householdName: row.name ?? undefined,
    rewardMode: row.reward_mode === 'flat' ? 'flat' : 'weighted',
    rewardModel: migrateLegacyRewardModel({ legacy: row.reward_model ?? DEFAULT_REWARD_MODEL }),
    hygieneRewarded: Boolean(row.hygiene_rewarded),
    hygieneXp: row.hygiene_xp === 10 ? 10 : 5,
    dailyDeadline: row.daily_deadline ?? null,
    dailyDeadlinePending: row.daily_deadline_pending ?? null,
    dailyDeadlineAppliesOn: row.daily_deadline_applies_on ?? null,
    allowanceRequestsEnabled: row.allowance_requests_enabled !== false,
    joinApprovalRequired: row.join_approval_required === true,
    sidekickGroceryAdd: Boolean(row.sidekick_grocery_add),
    memberCapabilities: mapMemberCapabilitiesFromRow(row.member_capabilities),
  };
}

export function mapCustomHouseRulesFromRows(
  rows: CustomHouseRuleRow[] | null | undefined
): HouseholdSnapshot['customHouseRules'] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    body: String(row.body ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

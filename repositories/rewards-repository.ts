import { mockHousehold } from '@/data/mock-household';
import { mapBadgeRow, mapRewardRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { Badge, Reward, RewardRedemption } from '@/types/orbit';

function mapRedemptionRow(row: {
  id: string;
  household_id: string;
  reward_id: string;
  member_id: string;
  status: RewardRedemption['status'];
  note: string | null;
  requested_at: string;
  decided_at: string | null;
}): RewardRedemption {
  return {
    id: row.id,
    householdId: row.household_id,
    rewardId: row.reward_id,
    memberId: row.member_id,
    status: row.status,
    note: row.note ?? undefined,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined,
  };
}

export const rewardsRepository = {
  async getRewards(householdId: string | null | undefined): Promise<Reward[]> {
    if (isMockMode()) {
      return clone(mockHousehold.rewards);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('rewardsRepository.getRewards');
    const { data, error } = await supabase.from('rewards').select('*').eq('household_id', householdId);
    mapDbError('rewardsRepository.getRewards', error);

    return (data ?? []).map((row) => mapRewardRow(row));
  },

  async getBadges(householdId: string | null | undefined): Promise<Badge[]> {
    if (isMockMode()) {
      return clone(mockHousehold.badges);
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('rewardsRepository.getBadges');
    const { data, error } = await supabase.from('badges').select('*').eq('household_id', householdId);
    mapDbError('rewardsRepository.getBadges', error);

    return (data ?? []).map((row) => mapBadgeRow(row));
  },

  async getRedemptions(householdId: string | null | undefined): Promise<RewardRedemption[]> {
    if (isMockMode()) {
      return [];
    }

    if (!householdId) {
      return [];
    }

    const supabase = getConfiguredSupabase('rewardsRepository.getRedemptions');
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('household_id', householdId)
      .order('requested_at', { ascending: false });
    mapDbError('rewardsRepository.getRedemptions', error);

    return (data ?? []).map((row) => mapRedemptionRow(row));
  },

  async requestRedemption(input: {
    householdId: string;
    rewardId: string;
    memberId: string;
    note?: string;
  }): Promise<RewardRedemption> {
    if (isMockMode()) {
      return {
        id: createLocalId('redemption'),
        householdId: input.householdId,
        rewardId: input.rewardId,
        memberId: input.memberId,
        status: 'pending',
        note: input.note,
        requestedAt: new Date().toISOString(),
      };
    }

    const supabase = getConfiguredSupabase('rewardsRepository.requestRedemption');
    const { data, error } = await supabase
      .from('reward_redemptions')
      .insert({
        household_id: input.householdId,
        reward_id: input.rewardId,
        member_id: input.memberId,
        status: 'pending',
        note: input.note ?? null,
      })
      .select('*')
      .single();
    mapDbError('rewardsRepository.requestRedemption', error);

    if (!data) {
      throw new Error('rewardsRepository.requestRedemption: Insert returned no row.');
    }

    return mapRedemptionRow(data);
  },

  async approveRedemption(redemptionId: string): Promise<RewardRedemption> {
    return decideRedemption(redemptionId, 'approved');
  },

  async rejectRedemption(redemptionId: string): Promise<RewardRedemption> {
    return decideRedemption(redemptionId, 'rejected');
  },
};

async function decideRedemption(
  redemptionId: string,
  status: 'approved' | 'rejected'
): Promise<RewardRedemption> {
  if (isMockMode()) {
    return {
      id: redemptionId,
      householdId: mockHousehold.id ?? 'hh-mock',
      rewardId: mockHousehold.rewards[0]?.id ?? 'r1',
      memberId: mockHousehold.members[0]?.id ?? 'm1',
      status,
      requestedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
    };
  }

  const supabase = getConfiguredSupabase(`rewardsRepository.${status}`);
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('reward_redemptions')
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: authData.user?.id ?? null,
    })
    .eq('id', redemptionId)
    .select('*')
    .single();
  mapDbError(`rewardsRepository.${status}`, error);

  if (!data) {
    throw new Error(`rewardsRepository.${status}: Update returned no row.`);
  }

  return mapRedemptionRow(data);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

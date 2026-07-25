import { mockHousehold } from '@/data/mock-household';
import { mapBadgeRow, mapRewardRow } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type {
  AllowanceGrant,
  Badge,
  CreateAllowanceInput,
  CreateRewardInput,
  Reward,
  RewardRedemption,
} from '@/types/orbit';

let mockRewardsState: Reward[] = clone(mockHousehold.rewards);
let mockRedemptionsState: RewardRedemption[] = [];
let mockAllowancesState: AllowanceGrant[] = [];

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
      return clone(mockRewardsState.filter((item) => !item.archived));
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
      return clone(mockRedemptionsState.filter((item) => item.householdId === (householdId ?? mockHousehold.id)));
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

  async createReward(householdId: string | null | undefined, input: CreateRewardInput): Promise<Reward> {
    const origin = input.origin ?? (input.specialRequest ? 'special-request' : 'minted');
    const reward: Reward = {
      id: createLocalId('reward'),
      title: input.title.trim(),
      cost: Math.max(1, Math.round(input.cost)),
      approvalRequired: input.approvalRequired ?? true,
      emoji: input.emoji,
      category: input.category ?? (input.specialRequest ? 'Special' : 'Privilege'),
      color: input.color,
      specialRequest: input.specialRequest ?? origin === 'special-request',
      origin,
      createdByMemberId: input.createdByMemberId,
      createdByName: input.createdByName,
      assignedMemberId: input.assignedMemberId,
      assignedMemberName: input.assignedMemberName,
      archived: false,
    };

    if (isMockMode()) {
      mockRewardsState = [reward, ...mockRewardsState];
      return clone(reward);
    }

    if (!householdId) {
      throw new Error('rewardsRepository.createReward: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('rewardsRepository.createReward');
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        household_id: householdId,
        title: reward.title,
        cost: reward.cost,
        approval_required: reward.approvalRequired,
      })
      .select('*')
      .single();
    mapDbError('rewardsRepository.createReward', error);
    return data
      ? {
          ...mapRewardRow(data),
          emoji: reward.emoji,
          category: reward.category,
          color: reward.color,
          specialRequest: reward.specialRequest,
          origin: reward.origin,
          createdByMemberId: reward.createdByMemberId,
          createdByName: reward.createdByName,
          assignedMemberId: reward.assignedMemberId,
          assignedMemberName: reward.assignedMemberName,
        }
      : reward;
  },

  async getAllowances(householdId: string | null | undefined): Promise<AllowanceGrant[]> {
    if (isMockMode()) {
      return clone(
        mockAllowancesState.filter((item) => item.householdId === (householdId ?? mockHousehold.id))
      );
    }
    // Allowance is mock-first until a Supabase table ships.
    return [];
  },

  async createAllowance(
    householdId: string | null | undefined,
    input: CreateAllowanceInput
  ): Promise<AllowanceGrant> {
    const grant: AllowanceGrant = {
      id: createLocalId('allowance'),
      householdId: householdId ?? mockHousehold.id ?? 'hh-mock',
      memberId: input.memberId,
      memberName: input.memberName,
      amountLabel: input.amountLabel.trim(),
      amountXp: input.amountXp,
      status: input.kind === 'admin-grant' ? 'approved' : 'pending',
      kind: input.kind,
      note: input.note,
      requestedAt: new Date().toISOString(),
      decidedAt: input.kind === 'admin-grant' ? new Date().toISOString() : undefined,
      createdByMemberId: input.createdByMemberId,
      createdByName: input.createdByName,
    };

    if (isMockMode()) {
      mockAllowancesState = [grant, ...mockAllowancesState];
      return clone(grant);
    }

    mockAllowancesState = [grant, ...mockAllowancesState];
    return clone(grant);
  },

  async approveAllowance(allowanceId: string): Promise<AllowanceGrant> {
    return decideAllowance(allowanceId, 'approved');
  },

  async rejectAllowance(allowanceId: string): Promise<AllowanceGrant> {
    return decideAllowance(allowanceId, 'rejected');
  },

  async updateReward(reward: Reward): Promise<Reward> {
    if (isMockMode()) {
      mockRewardsState = mockRewardsState.map((item) => (item.id === reward.id ? reward : item));
      return clone(reward);
    }

    const supabase = getConfiguredSupabase('rewardsRepository.updateReward');
    const { data, error } = await supabase
      .from('rewards')
      .update({
        title: reward.title,
        cost: reward.cost,
        approval_required: reward.approvalRequired,
      })
      .eq('id', reward.id)
      .select('*')
      .single();
    mapDbError('rewardsRepository.updateReward', error);
    return data ? mapRewardRow(data) : reward;
  },

  async archiveReward(rewardId: string): Promise<void> {
    if (isMockMode()) {
      mockRewardsState = mockRewardsState.map((item) =>
        item.id === rewardId ? { ...item, archived: true } : item
      );
      return;
    }

    const supabase = getConfiguredSupabase('rewardsRepository.archiveReward');
    const { error } = await supabase.from('rewards').delete().eq('id', rewardId);
    mapDbError('rewardsRepository.archiveReward', error);
  },

  async requestRedemption(input: {
    householdId: string;
    rewardId: string;
    memberId: string;
    note?: string;
  }): Promise<RewardRedemption> {
    if (isMockMode()) {
      const redemption: RewardRedemption = {
        id: createLocalId('redemption'),
        householdId: input.householdId,
        rewardId: input.rewardId,
        memberId: input.memberId,
        status: 'pending',
        note: input.note,
        requestedAt: new Date().toISOString(),
      };
      mockRedemptionsState = [redemption, ...mockRedemptionsState];
      return redemption;
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
    const existing = mockRedemptionsState.find((item) => item.id === redemptionId);
    const updated: RewardRedemption = {
      ...(existing ?? {
        id: redemptionId,
        householdId: mockHousehold.id ?? 'hh-mock',
        rewardId: mockHousehold.rewards[0]?.id ?? 'r1',
        memberId: mockHousehold.members[0]?.id ?? 'm1',
        requestedAt: new Date().toISOString(),
      }),
      status,
      decidedAt: new Date().toISOString(),
    };
    mockRedemptionsState = mockRedemptionsState.map((item) => (item.id === redemptionId ? updated : item));
    return updated;
  }

  const supabase = getConfiguredSupabase(`rewardsRepository.${status}`);
  const { data: authData } = await supabase.auth.getUser();

  const { data: redemption, error: lookupError } = await supabase
    .from('reward_redemptions')
    .select('*')
    .eq('id', redemptionId)
    .single();
  mapDbError(`rewardsRepository.${status}.lookup`, lookupError);

  if (!redemption) {
    throw new Error(`rewardsRepository.${status}: Redemption not found.`);
  }

  if (status === 'approved') {
    const { data: reward } = await supabase
      .from('rewards')
      .select('cost, title')
      .eq('id', redemption.reward_id)
      .maybeSingle();

    const cost = reward?.cost ?? 0;
    if (cost > 0) {
      const { data: member } = await supabase
        .from('household_members')
        .select('id, xp')
        .eq('id', redemption.member_id)
        .maybeSingle();

      if (member) {
        const nextXp = Math.max(0, (member.xp ?? 0) - cost);
        const { error: xpError } = await supabase
          .from('household_members')
          .update({ xp: nextXp })
          .eq('id', member.id);
        mapDbError(`rewardsRepository.${status}.xp`, xpError);

        const { error: txError } = await supabase.from('xp_transactions').insert({
          household_id: redemption.household_id,
          user_id: authData.user?.id ?? null,
          member_id: member.id,
          amount: -cost,
          reason: `Reward redeemed: ${reward?.title ?? 'Reward'}`,
        });
        mapDbError(`rewardsRepository.${status}.xpTransaction`, txError);
      }
    }
  }

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

async function decideAllowance(
  allowanceId: string,
  status: 'approved' | 'rejected'
): Promise<AllowanceGrant> {
  const existing = mockAllowancesState.find((item) => item.id === allowanceId);
  const updated: AllowanceGrant = {
    ...(existing ?? {
      id: allowanceId,
      householdId: mockHousehold.id ?? 'hh-mock',
      memberId: mockHousehold.members[0]?.id ?? 'm1',
      memberName: mockHousehold.members[0]?.name ?? 'Member',
      amountLabel: '$5',
      status: 'pending' as const,
      kind: 'member-request' as const,
      requestedAt: new Date().toISOString(),
    }),
    status,
    decidedAt: new Date().toISOString(),
  };
  mockAllowancesState = mockAllowancesState.map((item) =>
    item.id === allowanceId ? updated : item
  );
  return clone(updated);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Test helper — reset module mock state between scripted flows. */
export function __resetRewardsMockStateForTests() {
  mockRewardsState = clone(mockHousehold.rewards);
  mockRedemptionsState = [];
  mockAllowancesState = [];
}

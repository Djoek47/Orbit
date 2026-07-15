import { dataMode } from '@/config/data-mode';
import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { createLocalId, requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type {
  CreateHouseholdInput,
  HouseholdMember,
  HouseholdRole,
  HouseholdSnapshot,
  JoinHouseholdInput,
  OrbitUser,
} from '@/types/orbit';

export const householdRepository = {
  async getHousehold(): Promise<HouseholdSnapshot> {
    if (dataMode === 'mock') {
      return clone(mockHousehold);
    }

    requireMockOrSupabaseReady('householdRepository.getHousehold');
    return clone(mockHousehold);
  },

  async getMembers(): Promise<HouseholdMember[]> {
    if (dataMode === 'mock') {
      return clone(mockHousehold.members);
    }

    requireMockOrSupabaseReady('householdRepository.getMembers');
    return clone(mockHousehold.members);
  },

  async createHousehold(input: CreateHouseholdInput, user: OrbitUser): Promise<HouseholdSnapshot> {
    const household: HouseholdSnapshot = {
      ...createEmptyHousehold(user),
      id: createLocalId('hh'),
      householdName: input.name.trim(),
      householdType: input.type,
      inviteCode: createInviteCode(),
      greetingName: user.name,
      members: [
        {
          id: createLocalId('member'),
          name: user.name,
          role: 'owner',
          status: 'active',
          avatar: user.avatar,
          xp: 0,
          loadShare: 100,
        },
      ],
      nova: {
        title: 'Your Orbit is ready',
        summary: `${input.name.trim()} is ready. Add tasks, groceries, and events when your household is set.`,
        actions: ['Invite members', 'Create task'],
      },
    };

    if (dataMode === 'mock') {
      return household;
    }

    requireMockOrSupabaseReady('householdRepository.createHousehold');
    return household;
  },

  async joinHousehold(input: JoinHouseholdInput, user: OrbitUser): Promise<HouseholdSnapshot> {
    const household: HouseholdSnapshot = {
      ...mockHousehold,
      id: createLocalId('hh-joined'),
      householdName: 'Pending Orbit Home',
      inviteCode: input.inviteCode.trim().toUpperCase(),
      greetingName: user.name,
      members: [
        {
          id: createLocalId('member'),
          name: user.name,
          role: 'adult',
          status: 'pending',
          avatar: user.avatar,
          xp: 0,
          loadShare: 0,
        },
      ],
      tasks: [],
      groceries: [],
      events: [],
      rewards: [],
      badges: [],
      nova: {
        title: 'Join request sent',
        summary: 'Your household access is pending approval. Orbit will open fully once an owner accepts you.',
        actions: ['Check invite code', 'Message household owner'],
      },
    };

    if (dataMode === 'mock') {
      return household;
    }

    requireMockOrSupabaseReady('householdRepository.joinHousehold');
    return household;
  },

  async updateMemberRole(member: HouseholdMember, role: HouseholdRole): Promise<HouseholdMember> {
    const updatedMember = { ...member, role };

    if (dataMode === 'mock') {
      return updatedMember;
    }

    requireMockOrSupabaseReady('householdRepository.updateMemberRole');
    return updatedMember;
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInviteCode() {
  return `ORBIT-${Math.floor(1000 + Math.random() * 9000)}`;
}

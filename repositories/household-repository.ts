import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { childInviteEmoji } from '@/lib/household/child-invites';
import {
  clearActiveMockHousehold,
  loadActiveMockHousehold,
  saveActiveMockHousehold,
} from '@/lib/household/mock-active-household';
import { seedMockDomainsFromHousehold } from '@/lib/household/seed-mock-domains';
import { buildInviteLinks, createInviteCode, normalizeInviteCode } from '@/lib/invites/parse-invite';
import {
  mapBadgeRow,
  mapBriefingRow,
  mapEventRow,
  mapGroceryRow,
  mapMemberRow,
  mapRewardRow,
  mapTaskRow,
} from '@/lib/mappers/orbit-mappers';
import {
  DEFAULT_REWARD_MODEL,
  migrateLegacyRewardModel,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type {
  CreateHouseholdInput,
  HouseholdMember,
  HouseholdRole,
  HouseholdSnapshot,
  InviteLinks,
  JoinHouseholdInput,
  OrbitUser,
} from '@/types/orbit';
import type { HouseholdInviteRow, HouseholdMemberRow, HouseholdRow } from '@/types/database';

function migrateLoadedRewardModel(value: string | null | undefined): RewardModel {
  return migrateLegacyRewardModel({ legacy: value ?? DEFAULT_REWARD_MODEL });
}

export const householdRepository = {
  async getHousehold(): Promise<HouseholdSnapshot> {
    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      if (active?.id && active.id !== mockHousehold.id) {
        seedMockDomainsFromHousehold(active);
        return clone(active);
      }
      if (active?.id === mockHousehold.id) {
        // Persisted Rivera with member XP/settings edits — merge onto domain state.
        seedMockDomainsFromHousehold({
          ...active,
          tasks: active.tasks?.length ? active.tasks : mockHousehold.tasks,
          rewards: active.rewards?.length ? active.rewards : mockHousehold.rewards,
          groceries: active.groceries?.length ? active.groceries : mockHousehold.groceries,
          events: active.events?.length ? active.events : mockHousehold.events,
        });
        return clone({
          ...mockHousehold,
          ...active,
          tasks: active.tasks?.length ? active.tasks : mockHousehold.tasks,
          rewards: active.rewards?.length ? active.rewards : mockHousehold.rewards,
          groceries: active.groceries?.length ? active.groceries : mockHousehold.groceries,
          events: active.events?.length ? active.events : mockHousehold.events,
          members: active.members?.length ? active.members : mockHousehold.members,
        });
      }
      return clone(mockHousehold);
    }

    const supabase = getConfiguredSupabase('householdRepository.getHousehold');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    mapDbError('householdRepository.getHousehold.auth', authError);

    const userId = authData.user?.id;
    if (!userId) {
      return createEmptyHousehold({
        id: '',
        email: '',
        name: '',
        avatar: 'O',
        profileComplete: false,
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    mapDbError('householdRepository.getHousehold.membership', membershipError);

    if (!membership) {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
      return createEmptyHousehold({
        id: userId,
        email: authData.user?.email ?? '',
        name: profile?.display_name?.trim() || '',
        avatar: profile?.display_name?.charAt(0).toUpperCase() || 'O',
        profileComplete: Boolean(profile?.display_name?.trim()),
      });
    }

    return loadHouseholdSnapshot(membership.household_id, userId);
  },

  async getMembers(householdId?: string | null): Promise<HouseholdMember[]> {
    if (isMockMode()) {
      return clone(mockHousehold.members);
    }

    const supabase = getConfiguredSupabase('householdRepository.getMembers');
    const id = householdId ?? (await resolveActiveHouseholdId(supabase));
    if (!id) {
      return [];
    }

    const { data, error } = await supabase.from('household_members').select('*').eq('household_id', id);
    mapDbError('householdRepository.getMembers', error);

    return (data ?? [])
      .filter((row) => row.status !== 'removed')
      .map((row) => mapMemberRow(row));
  },

  async createHousehold(input: CreateHouseholdInput, user: OrbitUser): Promise<HouseholdSnapshot> {
    if (isMockMode()) {
      const base = createEmptyHousehold(user);
      const created: HouseholdSnapshot = {
        ...base,
        id: createLocalId('hh'),
        householdName: input.name.trim(),
        householdType: 'family',
        inviteCode: createInviteCode(),
        greetingName: user.name,
        rewardMode: input.rewardMode ?? 'weighted',
        rewardModel: input.rewardModel ?? 'full',
        setupComplete: input.setupComplete ?? false,
        hygieneRewarded: false,
        hygieneXp: 5,
        rooms:
          input.rooms && input.rooms.length > 0
            ? input.rooms.map((room) => ({ ...room }))
            : base.rooms,
        members: [
          {
            id: createLocalId('member'),
            name: user.name,
            role: 'owner',
            status: 'active',
            avatar: user.avatar,
            xp: 0,
            weekXp: 0,
            streak: 0,
            loadShare: 100,
          },
        ],
        poppins: {
          title: 'Your household is ready',
          summary: `${input.name.trim()} is ready. Add tasks, Plan events, and rewards when your household is set.`,
          actions: ['Invite members', 'Create task'],
        },
      };
      seedMockDomainsFromHousehold(created);
      await saveActiveMockHousehold(created);
      return created;
    }

    const supabase = getConfiguredSupabase('householdRepository.createHousehold');
    const inviteCode = createInviteCode();
    const deepLink = buildInviteLinks(inviteCode).deepLink;

    const rewardMode = input.rewardMode === 'flat' ? 'flat' : 'weighted';
    const rewardModel = input.rewardModel ?? 'full';

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({
        name: input.name.trim(),
        household_type: 'family',
        owner_id: user.id,
        reward_mode: rewardMode,
        reward_model: rewardModel,
        hygiene_rewarded: false,
        hygiene_xp: 5,
      } satisfies Partial<HouseholdRow> & Pick<HouseholdRow, 'name' | 'owner_id'>)
      .select('*')
      .single();
    mapDbError('householdRepository.createHousehold.household', householdError);

    if (!household) {
      throw new Error('householdRepository.createHousehold: Household insert returned no row.');
    }

    const { error: memberError } = await supabase.from('household_members').insert({
      household_id: household.id,
      user_id: user.id,
      display_name: user.name,
      role: 'owner',
      status: 'active',
      avatar_symbol: user.avatar,
      xp: 0,
      week_xp: 0,
      streak: 0,
      load_share: 100,
    } satisfies Partial<HouseholdMemberRow> & Pick<HouseholdMemberRow, 'household_id' | 'role'>);
    mapDbError('householdRepository.createHousehold.member', memberError);

    const { error: inviteError } = await supabase.from('household_invites').insert({
      household_id: household.id,
      invite_code: inviteCode,
      invite_link: deepLink,
      created_by: user.id,
    } satisfies Partial<HouseholdInviteRow> & Pick<HouseholdInviteRow, 'household_id' | 'invite_code'>);
    mapDbError('householdRepository.createHousehold.invite', inviteError);

    return loadHouseholdSnapshot(household.id, user.id);
  },

  async joinHousehold(input: JoinHouseholdInput, user: OrbitUser): Promise<HouseholdSnapshot> {
    const code = input.inviteCode.trim().toUpperCase();

    if (isMockMode()) {
      const pendingMember = {
        id: createLocalId('member'),
        name: user.name,
        role: 'adult' as const,
        status: 'pending' as const,
        avatar: user.avatar || user.name.slice(0, 1).toUpperCase(),
        xp: 0,
        weekXp: 0,
        streak: 0,
        loadShare: 0,
      };
      const existingWithoutDup = mockHousehold.members.filter(
        (member) => member.name.toLowerCase() !== user.name.toLowerCase()
      );
      return {
        ...mockHousehold,
        inviteCode: code || mockHousehold.inviteCode,
        greetingName: user.name,
        members: [...existingWithoutDup, pendingMember],
        poppins: {
          title: 'Join request sent',
          summary:
            'Your household access is pending approval. Browse calmly — create/edit stays locked until an owner or admin accepts you.',
          actions: ['Wait for approval', 'Ask an owner to open Members'],
        },
      };
    }

    const supabase = getConfiguredSupabase('householdRepository.joinHousehold');
    const { data, error } = await supabase.functions.invoke('join-household', {
      body: { inviteCode: code, displayName: user.name },
    });

    if (error) {
      throw new Error(error.message ?? 'householdRepository.joinHousehold: Join failed.');
    }

    const payload = data as { error?: string; householdId?: string; member?: { id: string } };
    if (payload?.error) {
      throw new Error(payload.error);
    }

    if (!payload?.householdId) {
      throw new Error('householdRepository.joinHousehold: Missing household id from join response.');
    }

    return loadPendingJoinSnapshot(payload.householdId, user, code);
  },

  async approveMember(memberId: string): Promise<HouseholdMember> {
    if (isMockMode()) {
      const member = mockHousehold.members.find((item) => item.id === memberId);
      if (!member) {
        throw new Error('householdRepository.approveMember: Member not found.');
      }
      return { ...member, status: 'active' };
    }

    const supabase = getConfiguredSupabase('householdRepository.approveMember');
    const { data, error } = await supabase
      .from('household_members')
      .update({ status: 'active' })
      .eq('id', memberId)
      .select('*')
      .single();
    mapDbError('householdRepository.approveMember', error);

    if (!data) {
      throw new Error('householdRepository.approveMember: Update returned no row.');
    }

    return mapMemberRow(data);
  },

  async declineMember(memberId: string): Promise<void> {
    if (isMockMode()) {
      return;
    }

    const supabase = getConfiguredSupabase('householdRepository.declineMember');
    const { error } = await supabase
      .from('household_members')
      .update({ status: 'removed' })
      .eq('id', memberId);
    mapDbError('householdRepository.declineMember', error);
  },

  async getPendingHouseholdSnapshot(user: OrbitUser): Promise<HouseholdSnapshot | null> {
    if (isMockMode()) {
      return null;
    }

    const supabase = getConfiguredSupabase('householdRepository.getPendingHouseholdSnapshot');
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      return null;
    }

    const { data: membership, error } = await supabase
      .from('household_members')
      .select('household_id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();
    mapDbError('householdRepository.getPendingHouseholdSnapshot', error);

    if (!membership?.household_id) {
      return null;
    }

    const { data: household } = await supabase
      .from('households')
      .select('name, id')
      .eq('id', membership.household_id)
      .maybeSingle();

    return {
      ...createEmptyHousehold(user),
      id: membership.household_id,
      householdName: household?.name ?? 'Pending household',
      greetingName: user.name,
      members: [
        {
          id: createLocalId('member'),
          name: user.name,
          role: 'adult',
          status: 'pending',
          avatar: user.avatar,
          xp: 0,
          weekXp: 0,
          streak: 0,
          loadShare: 0,
        },
      ],
      poppins: {
        title: 'Join request sent',
        summary: 'Waiting for an owner or admin to approve your access on Members.',
        actions: ['Check back soon', 'Message household owner'],
      },
    };
  },

  async updateMemberRole(member: HouseholdMember, role: HouseholdRole): Promise<HouseholdMember> {
    const updatedMember: HouseholdMember = {
      ...member,
      role,
      sharedWithMemberIds: role === 'shared-device' ? member.sharedWithMemberIds ?? [] : undefined,
    };

    if (isMockMode()) {
      mockHousehold.members = mockHousehold.members.map((item) =>
        item.id === member.id ? updatedMember : item
      );
      return updatedMember;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateMemberRole');
    const { error } = await supabase
      .from('household_members')
      .update({
        role,
        shared_with_member_ids: role === 'shared-device' ? updatedMember.sharedWithMemberIds ?? [] : null,
      })
      .eq('id', member.id);
    mapDbError('householdRepository.updateMemberRole', error);

    return updatedMember;
  },

  /**
   * Admin-owned child profile. Kids redeem via invite code / AirDrop — no email account.
   * Household data stays on the admin household.
   */
  async createChildMember(
    householdId: string | null | undefined,
    name: string
  ): Promise<HouseholdMember> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('householdRepository.createChildMember: name is required.');
    }

    const member: HouseholdMember = {
      id: createLocalId('member'),
      name: trimmed,
      role: 'child',
      status: 'active',
      avatar: childInviteEmoji(trimmed),
      xp: 0,
      weekXp: 0,
      streak: 0,
      loadShare: 0,
      profileInviteCode: undefined,
    };
    const fromName = trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6);
    member.profileInviteCode = normalizeInviteCode(
      fromName.length >= 3 ? `CMX-${fromName}` : createInviteCode(),
    );
    // Avoid colliding with an existing demo code in mock.
    if (isMockMode()) {
      const taken = new Set(
        mockHousehold.members
          .map((item) => item.profileInviteCode)
          .filter((code): code is string => Boolean(code))
          .map((code) => normalizeInviteCode(code)),
      );
      let attempt = member.profileInviteCode!;
      let n = 2;
      while (taken.has(attempt)) {
        attempt = normalizeInviteCode(`CMX-${fromName.slice(0, 4)}${n}`);
        n += 1;
      }
      member.profileInviteCode = attempt;
      // Only mutate the shared Rivera demo when inviting into that household.
      if (!householdId || householdId === mockHousehold.id) {
        mockHousehold.members = [...mockHousehold.members, member];
      }
      return member;
    }

    if (!householdId) {
      throw new Error('householdRepository.createChildMember: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('householdRepository.createChildMember');
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        display_name: member.name,
        role: 'child',
        status: 'active',
        avatar_symbol: member.avatar,
        xp: 0,
        week_xp: 0,
        streak: 0,
        load_share: 0,
      })
      .select('*')
      .single();
    mapDbError('householdRepository.createChildMember', error);

    const mapped = mapMemberRow(data as HouseholdMemberRow & { shared_with_member_ids?: string[] | null });
    return { ...mapped, profileInviteCode: member.profileInviteCode, role: 'child' };
  },

  async createSharedDevice(
    householdId: string | null | undefined,
    name: string
  ): Promise<HouseholdMember> {
    const member: HouseholdMember = {
      id: createLocalId('member'),
      name: name.trim() || 'Shared device',
      role: 'shared-device',
      status: 'active',
      avatar: '📱',
      xp: 0,
      weekXp: 0,
      streak: 0,
      loadShare: 0,
      sharedWithMemberIds: [],
    };

    if (isMockMode()) {
      mockHousehold.members = [...mockHousehold.members, member];
      return member;
    }

    if (!householdId) {
      throw new Error('householdRepository.createSharedDevice: householdId is required in Supabase mode.');
    }

    const supabase = getConfiguredSupabase('householdRepository.createSharedDevice');
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        display_name: member.name,
        role: 'shared-device',
        status: 'active',
        avatar_symbol: member.avatar,
        xp: 0,
        week_xp: 0,
        streak: 0,
        load_share: 0,
        shared_with_member_ids: [],
      })
      .select('*')
      .single();
    mapDbError('householdRepository.createSharedDevice', error);

    return mapMemberRow(data as HouseholdMemberRow & { shared_with_member_ids?: string[] | null });
  },

  async updateSharedDeviceLinks(
    device: HouseholdMember,
    memberIds: string[]
  ): Promise<HouseholdMember> {
    const unique = [...new Set(memberIds.filter(Boolean))];
    const updated: HouseholdMember = {
      ...device,
      role: 'shared-device',
      sharedWithMemberIds: unique,
    };

    if (isMockMode()) {
      mockHousehold.members = mockHousehold.members.map((item) =>
        item.id === device.id ? updated : item
      );
      return updated;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateSharedDeviceLinks');
    const { error } = await supabase
      .from('household_members')
      .update({ shared_with_member_ids: unique, role: 'shared-device' })
      .eq('id', device.id);
    mapDbError('householdRepository.updateSharedDeviceLinks', error);

    return updated;
  },

  async updateMemberAvatar(member: HouseholdMember, avatar: string): Promise<HouseholdMember> {
    const updatedMember = { ...member, avatar };

    if (isMockMode()) {
      mockHousehold.members = mockHousehold.members.map((item) =>
        item.id === member.id ? updatedMember : item,
      );
      return updatedMember;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateMemberAvatar');
    const { error } = await supabase
      .from('household_members')
      .update({ avatar_symbol: avatar })
      .eq('id', member.id);
    mapDbError('householdRepository.updateMemberAvatar', error);

    return updatedMember;
  },

  async removeMember(memberId: string): Promise<void> {
    if (isMockMode()) {
      mockHousehold.members = mockHousehold.members
        .filter((item) => item.id !== memberId)
        .map((item) =>
          item.role === 'shared-device'
            ? {
                ...item,
                sharedWithMemberIds: (item.sharedWithMemberIds ?? []).filter((id) => id !== memberId),
              }
            : item
        );
      return;
    }

    const supabase = getConfiguredSupabase('householdRepository.removeMember');
    const { error } = await supabase
      .from('household_members')
      .update({ status: 'removed' })
      .eq('id', memberId);
    mapDbError('householdRepository.removeMember', error);
  },

  async refreshInvite(householdId: string): Promise<InviteLinks> {
    const code = createInviteCode();
    const links = buildInviteLinks(code);

    if (isMockMode()) {
      return links;
    }

    const supabase = getConfiguredSupabase('householdRepository.refreshInvite');
    const { data: existing, error: existingError } = await supabase
      .from('household_invites')
      .select('id')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('householdRepository.refreshInvite.lookup', existingError);

    if (existing) {
      const { error } = await supabase
        .from('household_invites')
        .update({ invite_code: code, invite_link: links.deepLink, uses: 0 })
        .eq('id', existing.id);
      mapDbError('householdRepository.refreshInvite.update', error);
    } else {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('household_invites').insert({
        household_id: householdId,
        invite_code: code,
        invite_link: links.deepLink,
        created_by: authData.user?.id ?? null,
      });
      mapDbError('householdRepository.refreshInvite.insert', error);
    }

    return links;
  },

  async getInviteLink(householdId: string): Promise<InviteLinks> {
    if (isMockMode()) {
      return buildInviteLinks(mockHousehold.inviteCode || createInviteCode());
    }

    const supabase = getConfiguredSupabase('householdRepository.getInviteLink');
    const { data, error } = await supabase
      .from('household_invites')
      .select('invite_code')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('householdRepository.getInviteLink', error);

    if (!data?.invite_code) {
      return this.refreshInvite(householdId);
    }

    return buildInviteLinks(data.invite_code);
  },
};

async function resolveActiveHouseholdId(supabase: ReturnType<typeof getConfiguredSupabase>) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  mapDbError('householdRepository.resolveActiveHouseholdId', error);
  return data?.household_id ?? null;
}

async function loadHouseholdSnapshot(householdId: string, userId: string): Promise<HouseholdSnapshot> {
  const supabase = getConfiguredSupabase('householdRepository.loadHouseholdSnapshot');

  const [
    { data: household, error: householdError },
    { data: members, error: membersError },
    { data: invite, error: inviteError },
    { data: score, error: scoreError },
    { data: tasks, error: tasksError },
    { data: groceries, error: groceriesError },
    { data: events, error: eventsError },
    { data: rewards, error: rewardsError },
    { data: badges, error: badgesError },
    { data: briefing, error: briefingError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.from('households').select('*').eq('id', householdId).single(),
    supabase.from('household_members').select('*').eq('household_id', householdId),
    supabase
      .from('household_invites')
      .select('invite_code')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('household_scores')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('tasks').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
    supabase.from('grocery_items').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    supabase.from('rewards').select('*').eq('household_id', householdId),
    supabase.from('badges').select('*').eq('household_id', householdId),
    supabase
      .from('ai_briefings')
      .select('*')
      .eq('household_id', householdId)
      .eq('briefing_type', 'daily')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
  ]);

  mapDbError('householdRepository.loadHousehold.household', householdError);
  mapDbError('householdRepository.loadHousehold.members', membersError);
  mapDbError('householdRepository.loadHousehold.invite', inviteError);
  mapDbError('householdRepository.loadHousehold.score', scoreError);
  mapDbError('householdRepository.loadHousehold.tasks', tasksError);
  mapDbError('householdRepository.loadHousehold.groceries', groceriesError);
  mapDbError('householdRepository.loadHousehold.events', eventsError);
  mapDbError('householdRepository.loadHousehold.rewards', rewardsError);
  mapDbError('householdRepository.loadHousehold.badges', badgesError);
  mapDbError('householdRepository.loadHousehold.briefing', briefingError);
  mapDbError('householdRepository.loadHousehold.profile', profileError);

  if (!household) {
    throw new Error('householdRepository.loadHouseholdSnapshot: Household not found.');
  }

  const mappedMembers = (members ?? [])
    .filter((row) => row.status !== 'removed')
    .map((row) => mapMemberRow(row));
  const mappedTasks = (tasks ?? []).map((row) => mapTaskRow(row));
  const mappedGroceries = (groceries ?? []).map((row) => mapGroceryRow(row));
  const mappedEvents = (events ?? []).map((row) => mapEventRow(row));

  const greetingName =
    mappedMembers.find((member) => members?.find((row) => row.id === member.id)?.user_id === userId)?.name ||
    profile?.display_name?.trim() ||
    'there';

  return {
    id: household.id,
    householdName: household.name,
    householdType: 'family',
    inviteCode: invite?.invite_code ?? '',
    greetingName,
    momentum: score?.momentum_score ?? 0,
    trend: 0,
    completionRate: score?.task_completion_rate ?? 0,
    missingGroceries: mappedGroceries.filter((item) => item.status === 'Missing').length,
    upcomingEvents: mappedEvents.length,
    preferredStoreId: (household as { preferred_store_id?: string | null }).preferred_store_id ?? 'store-freshmart',
    rewardMode:
      (household as { reward_mode?: 'weighted' | 'flat' | null }).reward_mode === 'flat'
        ? 'flat'
        : 'weighted',
    rewardModel: migrateLoadedRewardModel(
      (household as { reward_model?: string | null }).reward_model
    ),
    hygieneRewarded: Boolean((household as { hygiene_rewarded?: boolean | null }).hygiene_rewarded),
    hygieneXp:
      (household as { hygiene_xp?: number | null }).hygiene_xp === 10 ? 10 : 5,
    memberCapabilities: ((household as { member_capabilities?: Record<string, boolean> | null })
      .member_capabilities ?? undefined) as HouseholdSnapshot['memberCapabilities'],
    members: mappedMembers,
    tasks: mappedTasks,
    groceries: mappedGroceries,
    events: mappedEvents,
    itineraries: [],
    rooms: [],
    accentThemeId: 'sky',
    taskTemplates: [],
    notificationPrefs: {
      tasks: true,
      itinerary: true,
      groceries: true,
      rewards: true,
      deals: true,
      plans: true,
      xpFairness: true,
    },
    rewards: (rewards ?? []).map((row) => mapRewardRow(row)),
    badges: (badges ?? []).map((row) => mapBadgeRow(row)),
    poppins: briefing
      ? mapBriefingRow(briefing)
      : {
          title: 'Welcome to Choremaxx',
          summary: 'Your household is synced. Poppins will fill in guidance as activity arrives.',
          actions: ['Create task', 'Check groceries'],
        },
  };
}

/** Persist mock household snapshot (members/settings/tasks) across Expo Go reload. */
export async function persistMockHouseholdSnapshot(household: HouseholdSnapshot) {
  if (!isMockMode() || !household.id) return;
  await saveActiveMockHousehold(household);
}

export async function clearMockHouseholdSnapshot() {
  if (!isMockMode()) return;
  await clearActiveMockHousehold();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function loadPendingJoinSnapshot(
  householdId: string,
  user: OrbitUser,
  inviteCode: string
): Promise<HouseholdSnapshot> {
  const supabase = getConfiguredSupabase('householdRepository.loadPendingJoinSnapshot');
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();

  return {
    ...createEmptyHousehold(user),
    id: householdId,
    householdName: household?.name ?? 'Pending household',
    inviteCode,
    greetingName: user.name,
    members: [
      {
        id: createLocalId('member'),
        name: user.name,
        role: 'adult',
        status: 'pending',
        avatar: user.avatar,
        xp: 0,
        weekXp: 0,
        streak: 0,
        loadShare: 0,
      },
    ],
    poppins: {
      title: 'Join request sent',
      summary: 'Waiting for an owner or admin to approve your access on Members.',
      actions: ['Check back soon', 'Message household owner'],
    },
  };
}

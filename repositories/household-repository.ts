import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import { AdminCapError, adminCapBlockedMessage } from '@/lib/household/admin-cap';
import { countAdminSeats } from '@/lib/household/admins';
import { childInviteEmoji } from '@/lib/household/child-invites';
import { allocateChildInviteCode } from '@/lib/household/profile-codes';
import { withHouseholdLock } from '@/lib/household/household-lock';
import {
  clearActiveMockHousehold,
  loadActiveMockHousehold,
  saveActiveMockHousehold,
} from '@/lib/household/mock-active-household';
import { seedMockDomainsFromHousehold } from '@/lib/household/seed-mock-domains';
import { peekPendingJoinHouseholdId } from '@/lib/invite/pending-join-store';
import { adminJoinRequestNotification } from '@/lib/invites/join-session';
import {
  resolveHydrateMembership,
  resolveJoinApprovalMembership,
  shouldLoadPendingPreview,
} from '@/lib/invites/join-approval';
import { buildInviteLinks, createInviteCode, allocateHouseholdInviteCode, normalizeInviteCode } from '@/lib/invites/parse-invite';
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
import { isUniqueViolation } from '@/lib/db/unique-violation';
import {
  createLocalId,
  getConfiguredSupabase,
  isMockMode,
  mapDbError,
} from '@/repositories/repository-utils';
import { notificationsRepository } from '@/repositories/notifications-repository';
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
      const pendingJoinId = await peekPendingJoinHouseholdId();
      const active = await loadActiveMockHousehold();
      if (pendingJoinId && active?.id === pendingJoinId) {
        seedMockDomainsFromHousehold(active);
        return clone(active);
      }
      if (active?.members?.some((member) => member.status === 'pending')) {
        seedMockDomainsFromHousehold(active);
        return clone(active);
      }
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

    const { data: memberships, error: membershipError } = await supabase
      .from('household_members')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending', 'invited']);
    mapDbError('householdRepository.getHousehold.membership', membershipError);

    const rows = memberships ?? [];
    const pendingJoinId = await peekPendingJoinHouseholdId();
    const membership = resolveHydrateMembership(rows, pendingJoinId);

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

    if (shouldLoadPendingPreview(membership.status)) {
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
      const name = profile?.display_name?.trim() || authData.user?.email?.split('@')[0] || '';
      return loadPendingJoinSnapshot(
        membership.household_id,
        {
          id: userId,
          email: authData.user?.email ?? '',
          name,
          avatar: name.charAt(0).toUpperCase() || 'O',
          profileComplete: Boolean(name),
        },
        ''
      );
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
    const rewardMode = input.rewardMode === 'flat' ? 'flat' : 'weighted';
    const rewardModel = input.rewardModel ?? 'full';
    const name = input.name.trim();

    if (isMockMode()) {
      const existing = await loadActiveMockHousehold();
      if (existing?.id && existing.members.some((member) => member.role === 'owner')) {
        const reused: HouseholdSnapshot = {
          ...existing,
          householdName: name || existing.householdName,
          rewardMode,
          rewardModel,
          setupComplete: input.setupComplete ?? existing.setupComplete ?? false,
          inviteCode: existing.inviteCode || createInviteCode(),
        };
        seedMockDomainsFromHousehold(reused);
        await saveActiveMockHousehold(reused);
        return reused;
      }
      const base = createEmptyHousehold(user);
      const created: HouseholdSnapshot = {
        ...base,
        id: createLocalId('hh'),
        householdName: name,
        householdType: 'family',
        inviteCode: createInviteCode(),
        greetingName: user.name,
        rewardMode,
        rewardModel,
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
          summary: `${name} is ready. Add tasks, Plan events, and rewards when your household is set.`,
          actions: ['Invite members', 'Create task'],
        },
      };
      seedMockDomainsFromHousehold(created);
      await saveActiveMockHousehold(created);
      return created;
    }

    const supabase = getConfiguredSupabase('householdRepository.createHousehold');

    const { data: owned, error: ownedError } = await supabase
      .from('households')
      .select('id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('householdRepository.createHousehold.owned', ownedError);

    let householdId = owned?.id ?? null;

    if (!householdId) {
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name,
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
      householdId = household.id;
    } else {
      const { error: updateError } = await supabase
        .from('households')
        .update({
          name,
          reward_mode: rewardMode,
          reward_model: rewardModel,
        })
        .eq('id', householdId);
      mapDbError('householdRepository.createHousehold.update', updateError);
    }

    const { data: existingOwner, error: ownerLookupError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .maybeSingle();
    mapDbError('householdRepository.createHousehold.ownerLookup', ownerLookupError);

    if (!existingOwner) {
      const { error: memberError } = await supabase.from('household_members').insert({
        household_id: householdId,
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
      if (memberError && !isUniqueViolation(memberError)) {
        mapDbError('householdRepository.createHousehold.member', memberError);
      }
    }

    const { data: existingInvite, error: inviteLookupError } = await supabase
      .from('household_invites')
      .select('invite_code')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    mapDbError('householdRepository.createHousehold.inviteLookup', inviteLookupError);

    if (!existingInvite?.invite_code) {
      await insertHouseholdInviteWithRetry(supabase, householdId, user.id);
    }

    return loadHouseholdSnapshot(householdId, user.id);
  },

  async joinHousehold(input: JoinHouseholdInput, user: OrbitUser): Promise<HouseholdSnapshot> {
    const code = input.inviteCode.trim().toUpperCase();
    const displayName = input.displayName?.trim() || user.name;

    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      const baseMembers = active?.members?.length ? active.members : mockHousehold.members;
      const householdId =
        active?.id && active.id !== mockHousehold.id
          ? active.id
          : `hh-join-${code.replace(/[^A-Z0-9]+/g, '') || 'invite'}`;

      if (input.memberId) {
        const seatIndex = baseMembers.findIndex(
          (member) => member.id === input.memberId && member.status === 'invited'
        );
        if (seatIndex >= 0) {
          const seat = baseMembers[seatIndex];
          const claimed = {
            ...seat,
            name: displayName || seat.name,
            status: 'pending' as const,
            userId: user.id,
          };
          const members = baseMembers.map((member, index) =>
            index === seatIndex ? claimed : member
          );
          const snapshot = {
            ...(active ?? mockHousehold),
            id: householdId,
            householdName: active?.householdName ?? 'Invited household',
            inviteCode: code || active?.inviteCode || mockHousehold.inviteCode,
            greetingName: claimed.name,
            members,
            poppins: {
              title: 'Join request sent',
              summary:
                'Your household access is pending approval. Browse calmly — create/edit stays locked until an owner or admin accepts you.',
              actions: ['Wait for approval', 'Ask an owner to open Members'],
            },
          };
          const notice = adminJoinRequestNotification({ requesterName: claimed.name });
          void notificationsRepository.create({
            householdId,
            title: notice.title,
            body: notice.body,
            category: notice.category,
            priority: notice.priority,
            data: notice.data,
          });
          return snapshot;
        }
      }

      const pendingMember = {
        id: createLocalId('member'),
        name: displayName,
        role: 'adult' as const,
        status: 'pending' as const,
        userId: user.id,
        avatar: user.avatar || user.name.slice(0, 1).toUpperCase(),
        xp: 0,
        weekXp: 0,
        streak: 0,
        loadShare: 0,
      };
      const snapshot = {
        ...mockHousehold,
        id: householdId,
        householdName: active?.householdName ?? 'Invited household',
        inviteCode: code || mockHousehold.inviteCode,
        greetingName: pendingMember.name,
        members: [
          ...baseMembers.filter(
            (member) => member.name.toLowerCase() !== pendingMember.name.toLowerCase()
          ),
          pendingMember,
        ],
        poppins: {
          title: 'Join request sent',
          summary:
            'Your household access is pending approval. Browse calmly — create/edit stays locked until an owner or admin accepts you.',
          actions: ['Wait for approval', 'Ask an owner to open Members'],
        },
      };
      const notice = adminJoinRequestNotification({ requesterName: pendingMember.name });
      void notificationsRepository.create({
        householdId,
        title: notice.title,
        body: notice.body,
        category: notice.category,
        priority: notice.priority,
        data: notice.data,
      });
      return snapshot;
    }

    const supabase = getConfiguredSupabase('householdRepository.joinHousehold');
    const { data, error } = await supabase.functions.invoke('join-household', {
      body: {
        inviteCode: code,
        displayName,
        memberId: input.memberId,
      },
    });

    if (error) {
      throw new Error(error.message ?? 'householdRepository.joinHousehold: Join failed.');
    }

    const payload = data as {
      error?: string;
      householdId?: string;
      member?: { id: string; status?: string; role?: string };
      alreadyMember?: boolean;
      alreadyPending?: boolean;
    };
    if (payload?.error) {
      throw new Error(payload.error);
    }

    if (!payload?.householdId) {
      throw new Error('householdRepository.joinHousehold: Missing household id from join response.');
    }

    if (payload.alreadyMember) {
      return loadHouseholdSnapshot(payload.householdId, user.id);
    }

    return loadPendingJoinSnapshot(payload.householdId, user, code);
  },

  async approveMember(memberId: string): Promise<HouseholdMember> {
    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      const pool = active?.members ?? mockHousehold.members;
      const member = pool.find((item) => item.id === memberId);
      if (!member) {
        throw new Error('householdRepository.approveMember: Member not found.');
      }
      return { ...member, status: 'active', userId: member.userId ?? null };
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

  async checkJoinApproval(
    user: OrbitUser,
    householdId: string | null | undefined
  ): Promise<{ status: 'approved' | 'pending' | 'missing'; snapshot: HouseholdSnapshot | null }> {
    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      const snapshot = active ?? mockHousehold;
      const pending = snapshot.members.find(
        (member) =>
          member.status === 'pending' &&
          member.name.toLowerCase() === user.name.toLowerCase()
      );
      if (pending) {
        return { status: 'pending', snapshot: clone(snapshot) };
      }
      const activeSelf = snapshot.members.find(
        (member) =>
          member.status === 'active' &&
          member.name.toLowerCase() === user.name.toLowerCase()
      );
      if (householdId && snapshot.id !== householdId) {
        return {
          status: 'pending',
          snapshot: {
            ...clone(snapshot),
            id: householdId,
            householdName: 'Invited household',
            greetingName: user.name,
            members: [
              {
                id: createLocalId('member'),
                name: user.name,
                role: 'adult',
                status: 'pending',
                avatar: user.avatar || user.name.slice(0, 1).toUpperCase(),
                xp: 0,
                weekXp: 0,
                streak: 0,
                loadShare: 0,
              },
            ],
          },
        };
      }
      if (activeSelf && (!householdId || snapshot.id === householdId)) {
        return { status: 'approved', snapshot: clone(snapshot) };
      }
      return { status: 'missing', snapshot: null };
    }

    const supabase = getConfiguredSupabase('householdRepository.checkJoinApproval');
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      return { status: 'missing', snapshot: null };
    }

    const { data: rows, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending', 'invited']);
    mapDbError('householdRepository.checkJoinApproval', error);
    const resolved = resolveJoinApprovalMembership(rows ?? [], householdId);
    if (resolved.status === 'missing' || !resolved.membership) {
      return { status: 'missing', snapshot: null };
    }
    if (resolved.status === 'approved') {
      return {
        status: 'approved',
        snapshot: await loadHouseholdSnapshot(resolved.membership.household_id, userId),
      };
    }
    return {
      status: 'pending',
      snapshot: await loadPendingJoinSnapshot(resolved.membership.household_id, user, ''),
    };
  },

  async findChildByProfileCode(code: string): Promise<{
    member: HouseholdMember;
    householdId: string;
    householdName: string;
  } | null> {
    const normalized = normalizeInviteCode(code);

    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      const pools = [active?.members ?? [], mockHousehold.members];
      for (const members of pools) {
        const member = members.find(
          (item) =>
            item.status === 'active' &&
            (item.role === 'child' || item.role === 'adult' || item.role === 'admin') &&
            normalizeInviteCode(item.profileInviteCode ?? '') === normalized
        );
        if (member) {
          const householdId = active?.id && active.members.some((m) => m.id === member.id)
            ? active.id
            : mockHousehold.id ?? 'hh-rivera';
          const householdName =
            active?.id === householdId ? active.householdName : mockHousehold.householdName;
          return { member, householdId: householdId ?? 'hh-rivera', householdName };
        }
      }
      return null;
    }

    const supabase = getConfiguredSupabase('householdRepository.findChildByProfileCode');
    const { data, error } = await supabase.functions.invoke('redeem-profile-invite', {
      body: { code: normalized },
    });
    if (error || !data || typeof data !== 'object') {
      return null;
    }
    const payload = data as {
      error?: string;
      member?: Parameters<typeof mapMemberRow>[0] & { household_id?: string };
      householdId?: string;
      householdName?: string;
    };
    if (payload.error || !payload.member || !payload.householdId) {
      return null;
    }
    return {
      member: mapMemberRow(payload.member),
      householdId: payload.householdId,
      householdName: payload.householdName ?? 'Household',
    };
  },

  async updateMemberRole(member: HouseholdMember, role: HouseholdRole): Promise<HouseholdMember> {
    const updatedMember: HouseholdMember = {
      ...member,
      role,
      sharedWithMemberIds: role === 'shared-device' ? member.sharedWithMemberIds ?? [] : undefined,
    };

    if (isMockMode()) {
      if (role === 'admin') {
        return withHouseholdLock(mockHousehold.id ?? 'mock', async () => {
          if (countAdminSeats(mockHousehold.members) >= 2 && member.role !== 'admin' && member.role !== 'owner') {
            throw new AdminCapError(adminCapBlockedMessage(mockHousehold.members, member.id));
          }
          mockHousehold.members = mockHousehold.members.map((item) =>
            item.id === member.id ? updatedMember : item
          );
          return updatedMember;
        });
      }
      mockHousehold.members = mockHousehold.members.map((item) =>
        item.id === member.id ? updatedMember : item
      );
      return updatedMember;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateMemberRole');
    if (role === 'admin') {
      const { error: rpcError } = await supabase.rpc('promote_member_to_admin', {
        p_member_id: member.id,
      });
      mapDbError('householdRepository.updateMemberRole', rpcError);
      return updatedMember;
    }
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
    return this.createOnboardingMember(householdId, { name, role: 'child' });
  },

  /**
   * Persist an onboarding roster person into household_members (no auth user).
   * Roles: child (helpers/kids), adult/admin (co-parents pending their own join).
   */
  async createOnboardingMember(
    householdId: string | null | undefined,
    input: { name: string; role: HouseholdRole; avatar?: string }
  ): Promise<HouseholdMember> {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error('householdRepository.createOnboardingMember: name is required.');
    }
    const role: HouseholdRole =
      input.role === 'admin' || input.role === 'adult' || input.role === 'child'
        ? input.role
        : 'child';

    const member: HouseholdMember = {
      id: createLocalId('member'),
      name: trimmed,
      role,
      status: 'invited',
      userId: null,
      avatar:
        input.avatar?.trim() ||
        (role === 'child' ? childInviteEmoji(trimmed) : trimmed.charAt(0).toUpperCase()),
      xp: 0,
      weekXp: 0,
      streak: 0,
      loadShare: 0,
      profileInviteCode: undefined,
    };
    if (role === 'child') {
      member.profileInviteCode = allocateChildInviteCode(trimmed);
    }

    if (isMockMode()) {
      if (member.profileInviteCode) {
        const active = await loadActiveMockHousehold();
        const pool = [
          ...(active?.members ?? []),
          ...mockHousehold.members,
        ];
        const taken = pool
          .map((item) => item.profileInviteCode)
          .filter((code): code is string => Boolean(code));
        member.profileInviteCode = allocateChildInviteCode(trimmed, taken);
      }
      // Prefer the active mock household when present; fall back to Rivera demo.
      const active = await loadActiveMockHousehold();
      if (active?.id && (!householdId || householdId === active.id)) {
        const next = {
          ...active,
          members: [...active.members.filter((m) => m.id !== member.id), member],
        };
        await saveActiveMockHousehold(next);
      } else if (!householdId || householdId === mockHousehold.id) {
        mockHousehold.members = [...mockHousehold.members, member];
      }
      return member;
    }

    if (!householdId) {
      throw new Error(
        'householdRepository.createOnboardingMember: householdId is required in Supabase mode.'
      );
    }

    const supabase = getConfiguredSupabase('householdRepository.createOnboardingMember');
    const { data: existingRows, error: existingError } = await supabase
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'active');
    mapDbError('householdRepository.createOnboardingMember.existing', existingError);
    const existingMatch = (existingRows ?? []).find(
      (row) =>
        String(row.display_name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
        row.role !== 'owner'
    );
    if (existingMatch) {
      return mapMemberRow(
        existingMatch as HouseholdMemberRow & { shared_with_member_ids?: string[] | null }
      );
    }

    const taken = new Set<string>();
    let lastError: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (role === 'child') {
        member.profileInviteCode = allocateChildInviteCode(trimmed, taken);
      }
      const { data, error } = await supabase
        .from('household_members')
        .insert({
          household_id: householdId,
          display_name: member.name,
          role,
          status: 'invited',
          avatar_symbol: member.avatar,
          xp: 0,
          week_xp: 0,
          streak: 0,
          load_share: 0,
          profile_invite_code: member.profileInviteCode ?? null,
        })
        .select('*')
        .single();
      if (!error) {
        const mapped = mapMemberRow(
          data as HouseholdMemberRow & { shared_with_member_ids?: string[] | null }
        );
        return {
          ...mapped,
          profileInviteCode: mapped.profileInviteCode ?? member.profileInviteCode,
          role,
        };
      }
      lastError = error;
      if (isUniqueViolation(error)) {
        if (member.profileInviteCode) taken.add(member.profileInviteCode);
        continue;
      }
      mapDbError('householdRepository.createOnboardingMember', error);
    }
    mapDbError('householdRepository.createOnboardingMember', lastError);

    throw new Error('householdRepository.createOnboardingMember: invite code retry exhausted.');
  },

  async updateMemberDisplayName(
    memberId: string,
    name: string,
    householdId?: string | null
  ): Promise<HouseholdMember | null> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('householdRepository.updateMemberDisplayName: name is required.');
    }

    if (isMockMode()) {
      const active = await loadActiveMockHousehold();
      if (active?.id) {
        const nextMembers = active.members.map((m) =>
          m.id === memberId
            ? { ...m, name: trimmed, avatar: m.avatar?.length === 1 ? trimmed.charAt(0).toUpperCase() : m.avatar }
            : m
        );
        await saveActiveMockHousehold({ ...active, members: nextMembers });
        return nextMembers.find((m) => m.id === memberId) ?? null;
      }
      mockHousehold.members = mockHousehold.members.map((m) =>
        m.id === memberId ? { ...m, name: trimmed } : m
      );
      return mockHousehold.members.find((m) => m.id === memberId) ?? null;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateMemberDisplayName');
    let query = supabase
      .from('household_members')
      .update({ display_name: trimmed })
      .eq('id', memberId);
    if (householdId) {
      query = query.eq('household_id', householdId);
    }
    const { data, error } = await query.select('*').single();
    mapDbError('householdRepository.updateMemberDisplayName', error);
    return data
      ? mapMemberRow(data as HouseholdMemberRow & { shared_with_member_ids?: string[] | null })
      : null;
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
    // TODO(product): What happens to the household if the Owner leaves or the subscription
    // lapses? Default shipped: nothing auto-promotes.
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

async function insertHouseholdInviteWithRetry(
  supabase: ReturnType<typeof getConfiguredSupabase>,
  householdId: string,
  userId: string
): Promise<string> {
  const taken = new Set<string>();
  let lastError: { code?: string; message?: string; details?: string } | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = allocateHouseholdInviteCode(taken);
    const deepLink = buildInviteLinks(inviteCode).deepLink;
    const { error } = await supabase.from('household_invites').insert({
      household_id: householdId,
      invite_code: inviteCode,
      invite_link: deepLink,
      created_by: userId,
    } satisfies Partial<HouseholdInviteRow> & Pick<HouseholdInviteRow, 'household_id' | 'invite_code'>);
    if (!error) return inviteCode;
    lastError = error;
    if (isUniqueViolation(error)) {
      taken.add(inviteCode);
      continue;
    }
    mapDbError('householdRepository.createHousehold.invite', error);
  }
  mapDbError('householdRepository.createHousehold.invite', lastError);
  throw new Error('householdRepository.createHousehold: invite retry exhausted.');
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
    { data: customRules, error: customRulesError },
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
    supabase
      .from('custom_house_rules')
      .select('id, body, sort_order')
      .eq('household_id', householdId)
      .order('sort_order', { ascending: true }),
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
  if (customRulesError) {
    console.warn('householdRepository.loadHousehold.customHouseRules', customRulesError);
  }

  if (!household) {
    throw new Error('householdRepository.loadHouseholdSnapshot: Household not found.');
  }

  const mappedMembers = (members ?? [])
    .filter((row) => row.status !== 'removed')
    .map((row) => mapMemberRow(row));
  const mappedTasks = (tasks ?? []).map((row) => mapTaskRow(row));
  const mappedGroceries = (groceries ?? []).map((row) => mapGroceryRow(row));
  const mappedEvents = (events ?? []).map((row) => mapEventRow(row));
  const mappedCustomRules = (
    (customRules ?? []) as { id?: string; body?: string; sort_order?: number }[]
  ).map((row) => ({
    id: String(row.id),
    body: String(row.body ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
  }));

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
    dailyDeadline: (household as { daily_deadline?: string | null }).daily_deadline ?? null,
    dailyDeadlinePending: (household as { daily_deadline_pending?: string | null }).daily_deadline_pending ?? null,
    dailyDeadlineAppliesOn:
      (household as { daily_deadline_applies_on?: string | null }).daily_deadline_applies_on ?? null,
    allowanceRequestsEnabled:
      (household as { allowance_requests_enabled?: boolean | null }).allowance_requests_enabled !== false,
    sidekickGroceryAdd: Boolean(
      (household as { sidekick_grocery_add?: boolean | null }).sidekick_grocery_add
    ),
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
    customHouseRules: mappedCustomRules,
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

/** Replace custom house rules for a household. Display-only — never alters mechanics. */
export async function persistCustomHouseRulesRows(
  householdId: string,
  rules: { id: string; body: string; sortOrder: number }[]
) {
  if (isMockMode()) return;
  const supabase = getConfiguredSupabase('householdRepository.persistCustomHouseRules');
  const { error: deleteError } = await supabase
    .from('custom_house_rules')
    .delete()
    .eq('household_id', householdId);
  mapDbError('householdRepository.persistCustomHouseRules.delete', deleteError);
  if (!rules.length) return;
  const { error: insertError } = await supabase.from('custom_house_rules').insert(
    rules.map((rule) => ({
      id: rule.id,
      household_id: householdId,
      body: rule.body,
      sort_order: rule.sortOrder,
    })) as never
  );
  mapDbError('householdRepository.persistCustomHouseRules.insert', insertError);
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

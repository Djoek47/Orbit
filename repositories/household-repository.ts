import { createEmptyHousehold, mockHousehold } from '@/data/mock-household';
import {
  mapBadgeRow,
  mapBriefingRow,
  mapEventRow,
  mapGroceryRow,
  mapMemberRow,
  mapRewardRow,
  mapTaskRow,
} from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type {
  CreateHouseholdInput,
  HouseholdMember,
  HouseholdRole,
  HouseholdSnapshot,
  HouseholdType,
  InviteLinks,
  JoinHouseholdInput,
  OrbitUser,
} from '@/types/orbit';
import type { HouseholdInviteRow, HouseholdMemberRow, HouseholdRow } from '@/types/database';

export const householdRepository = {
  async getHousehold(): Promise<HouseholdSnapshot> {
    if (isMockMode()) {
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
      return {
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
            weekXp: 0,
            streak: 0,
            loadShare: 100,
          },
        ],
        nova: {
          title: 'Your Orbit is ready',
          summary: `${input.name.trim()} is ready. Add tasks, groceries, and events when your household is set.`,
          actions: ['Invite members', 'Create task'],
        },
      };
    }

    const supabase = getConfiguredSupabase('householdRepository.createHousehold');
    const inviteCode = createInviteCode();
    const deepLink = inviteDeepLink(inviteCode);

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({
        name: input.name.trim(),
        household_type: input.type,
        owner_id: user.id,
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
      return {
        ...mockHousehold,
        id: createLocalId('hh-joined'),
        householdName: 'Pending Orbit Home',
        inviteCode: code,
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
    }

    const supabase = getConfiguredSupabase('householdRepository.joinHousehold');
    const { data: invite, error: inviteError } = await supabase
      .from('household_invites')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();
    mapDbError('householdRepository.joinHousehold.invite', inviteError);

    if (!invite) {
      throw new Error('householdRepository.joinHousehold: Invite code not found.');
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error('householdRepository.joinHousehold: Invite code has expired.');
    }

    const { error: memberError } = await supabase.from('household_members').insert({
      household_id: invite.household_id,
      user_id: user.id,
      display_name: user.name,
      role: 'adult',
      status: 'pending',
      avatar_symbol: user.avatar,
      xp: 0,
      week_xp: 0,
      streak: 0,
      load_share: 0,
    });
    mapDbError('householdRepository.joinHousehold.member', memberError);

    await supabase
      .from('household_invites')
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq('id', invite.id);

    // Pending members are not yet active household members under RLS, so return a local pending snapshot.
    return {
      ...createEmptyHousehold(user),
      id: invite.household_id,
      householdName: 'Pending Orbit Home',
      inviteCode: code,
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
      nova: {
        title: 'Join request sent',
        summary: 'Your household access is pending approval. Orbit will open fully once an owner accepts you.',
        actions: ['Check invite code', 'Message household owner'],
      },
    };
  },

  async updateMemberRole(member: HouseholdMember, role: HouseholdRole): Promise<HouseholdMember> {
    const updatedMember = { ...member, role };

    if (isMockMode()) {
      return updatedMember;
    }

    const supabase = getConfiguredSupabase('householdRepository.updateMemberRole');
    const { error } = await supabase.from('household_members').update({ role }).eq('id', member.id);
    mapDbError('householdRepository.updateMemberRole', error);

    return updatedMember;
  },

  async removeMember(memberId: string): Promise<void> {
    if (isMockMode()) {
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
    householdType: (household.household_type as HouseholdType) || 'family',
    inviteCode: invite?.invite_code ?? '',
    greetingName,
    momentum: score?.momentum_score ?? 0,
    trend: 0,
    completionRate: score?.task_completion_rate ?? 0,
    missingGroceries: mappedGroceries.filter((item) => item.status === 'Missing').length,
    upcomingEvents: mappedEvents.length,
    members: mappedMembers,
    tasks: mappedTasks,
    groceries: mappedGroceries,
    events: mappedEvents,
    rewards: (rewards ?? []).map((row) => mapRewardRow(row)),
    badges: (badges ?? []).map((row) => mapBadgeRow(row)),
    nova: briefing
      ? mapBriefingRow(briefing)
      : {
          title: 'Welcome to Orbit',
          summary: 'Your household is synced. Nova will fill in guidance as activity arrives.',
          actions: ['Create task', 'Check groceries'],
        },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createInviteCode() {
  return `ORBIT-${Math.floor(1000 + Math.random() * 9000)}`;
}

function inviteDeepLink(code: string) {
  return `orbit://join/${code}`;
}

function buildInviteLinks(code: string): InviteLinks {
  return {
    code,
    deepLink: inviteDeepLink(code),
    webLink: `https://orbit.app/join/${code}`,
  };
}

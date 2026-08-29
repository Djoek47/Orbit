import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { MemberInviteSheet } from '@/components/orbit/member-invite-sheet';
import { ProfileInviteSheet } from '@/components/orbit/profile-invite-sheet';
import {
  MemberConnectionBadge,
  MemberConnectionCaption,
  HasOwnAccountBadge,
} from '@/components/orbit/member-connection-badge';
import {
  MemberTrustSwitch,
  MembersJoinPolicyGroup,
} from '@/components/orbit/members/join-policy-controls';
import { SetupMemberWizard } from '@/components/orbit/setup-member-wizard';
import { DEFAULT_REWARD_MODEL } from '@/lib/rewards/reward-model';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import type { MemberInvite } from '@/lib/household/member-invites';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  canPromoteToAdmin,
  familyAdminSeatsLabel,
  usesFamilyAdminCap,
} from '@/lib/household/admins';
import { adminCapBlockedMessage } from '@/lib/household/admin-cap';
import {
  memberCanReceiveInvite,
  memberUsesProfileInvite,
} from '@/lib/household/member-invite-routing';
import { memberConnectionPhase } from '@/lib/household/member-connection';
import {
  countMembersForMembersScreen,
  canLockInvites,
  getJoinPolicyMode,
  isReviewJoinPolicy,
  JOIN_POLICY_COPY,
  membersScreenStatusLine,
} from '@/lib/household/join-policy';
import {
  isSharedDeviceMember,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdRole } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

const ROLE_CYCLE: HouseholdRole[] = ['adult', 'admin', 'child', 'guest', 'shared-device'];

function nextRole(current: HouseholdRole, canAdmin: boolean): HouseholdRole {
  if (current === 'owner') return 'owner';
  const cycle = canAdmin ? ROLE_CYCLE : ROLE_CYCLE.filter((role) => role !== 'admin');
  const index = cycle.indexOf(current);
  if (index < 0) return cycle[0] ?? 'adult';
  return cycle[(index + 1) % cycle.length];
}

type InviteTarget =
  | { kind: 'profile'; memberId: string }
  | { kind: 'token'; memberId: string }
  | null;

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.headline, { color: c.text }]}>{title}</Text>
      {hint ? (
        <Text style={[typography.footnote, { color: c.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function HouseholdMembersScreen() {
  const {
    approveMember,
    currentMember,
    declineMember,
    household,
    permissions,
    removeMember,
    updateMemberRole,
    updateSharedDeviceLinks,
    addOnboardingMembers,
    setJoinApprovalRequired,
  } = useOrbit();
  const { c } = useOrbitColors();

  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const pending = useMemo(
    () => household.members.filter((m) => memberConnectionPhase(m) === 'pending_approval'),
    [household.members]
  );
  const awaiting = useMemo(
    () =>
      household.members.filter(
        (m) =>
          memberConnectionPhase(m) === 'awaiting' &&
          m.role !== 'owner' &&
          !isSharedDeviceMember(m)
      ),
    [household.members]
  );
  const connected = useMemo(
    () =>
      household.members.filter((m) => memberConnectionPhase(m) === 'connected'),
    [household.members]
  );

  const counts = useMemo(() => countMembersForMembersScreen(household.members), [household.members]);
  const policy = getJoinPolicyMode(household);
  const adminSeats = familyAdminSeatsLabel(household.members);
  const familyCap = usesFamilyAdminCap();
  const linkCandidates = sharedDeviceLinkCandidates(household.members);

  const statusLine = membersScreenStatusLine(
    counts,
    policy,
    familyCap && counts.pending === 0 && counts.awaiting === 0 ? adminSeats : undefined
  );
  const showInviteLock =
    permissions.canManageHousehold &&
    isReviewJoinPolicy(household) &&
    canLockInvites(household.members);

  const inviteMember =
    inviteTarget?.memberId != null
      ? (household.members.find((m) => m.id === inviteTarget.memberId) ?? null)
      : null;

  const openInvite = (member: HouseholdMember) => {
    if (memberUsesProfileInvite(member)) {
      setInviteTarget({ kind: 'profile', memberId: member.id });
      return;
    }
    setInviteTarget({ kind: 'token', memberId: member.id });
  };

  const handleApproveAs = (memberId: string, asAdmin: boolean) => {
    void (async () => {
      await approveMember(memberId);
      if (asAdmin) {
        if (!canPromoteToAdmin(household, memberId)) {
          Alert.alert('Approved as adult', 'Admin seats are full, so they joined as Adult.');
          return;
        }
        await updateMemberRole(memberId, 'admin');
      }
    })();
  };

  const handleRemove = (memberId: string, name: string, role: HouseholdRole) => {
    if (role === 'owner') {
      Alert.alert('Cannot remove', 'The household owner cannot be removed.');
      return;
    }
    Alert.alert('Remove member', `Remove ${name} from this household?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeMember(memberId) },
    ]);
  };

  const handleChangeRole = (memberId: string, currentRole: HouseholdRole) => {
    if (currentRole === 'owner') {
      Alert.alert('Owner role', 'The household owner role cannot be changed here.');
      return;
    }
    const allowAdmin = canPromoteToAdmin(household, memberId);
    const role = nextRole(currentRole, allowAdmin || currentRole === 'admin');
    if (role === 'admin' && !allowAdmin) {
      Alert.alert(
        'Admin seats full',
        familyCap
          ? adminCapBlockedMessage(household.members, memberId)
          : 'Cannot promote to admin right now.'
      );
      return;
    }
    void updateMemberRole(memberId, role);
  };

  const showManageActions = (member: HouseholdMember) => {
    if (!permissions.canManageHousehold || member.role === 'owner') return;

    const options: string[] = [];
    const handlers: (() => void)[] = [];

    if (
      member.role !== 'admin' &&
      member.role !== 'shared-device' &&
      canPromoteToAdmin(household, member.id)
    ) {
      options.push('Make co-admin');
      handlers.push(() => {
        Alert.alert(
          'Make co-admin',
          `Promote ${member.name} to Admin so they can manage tasks, invites, and approvals?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Make admin',
              onPress: () => {
                void updateMemberRole(member.id, 'admin').catch((error) => {
                  Alert.alert(
                    'Could not promote',
                    error instanceof Error ? error.message : 'Try again.'
                  );
                });
              },
            },
          ]
        );
      });
    }

    options.push('Change role');
    handlers.push(() => handleChangeRole(member.id, member.role));

    options.push('Remove from household');
    handlers.push(() => handleRemove(member.id, member.name, member.role));

    options.push('Cancel');
    handlers.push(() => {});

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: member.name,
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: options.indexOf('Remove from household'),
        },
        (index) => {
          if (index != null && index < handlers.length) handlers[index]?.();
        }
      );
      return;
    }

    Alert.alert(member.name, undefined, [
      ...options.slice(0, -1).map((label, index) => ({
        text: label,
        style: label === 'Remove from household' ? ('destructive' as const) : ('default' as const),
        onPress: handlers[index],
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

  const renderPendingCard = (member: HouseholdMember) => (
    <GlassCard key={member.id} style={styles.card}>
      <View style={styles.memberHeader}>
        <Avatar
          name={member.name}
          emoji={memberDisplayEmoji(member)}
          imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
          size="m"
        />
        <View style={styles.memberCopy}>
          <Text style={[typography.headline, { color: c.text }]}>{member.name}</Text>
          <Text style={[typography.footnote, { color: c.warning }]}>
            Wants to join your household
          </Text>
        </View>
        <MemberConnectionBadge member={member} />
      </View>
      <View style={styles.actionsStack}>
        <OrbitButton disabled={!permissions.canManageHousehold} onPress={() => handleApproveAs(member.id, false)}>
          Approve
        </OrbitButton>
        {permissions.canManageHousehold && canPromoteToAdmin(household, member.id) ? (
          <OrbitButton tone="secondary" onPress={() => handleApproveAs(member.id, true)}>
            Approve as admin
          </OrbitButton>
        ) : null}
        <OrbitButton
          disabled={!permissions.canManageHousehold}
          tone="danger"
          onPress={() => void declineMember(member.id)}>
          Decline
        </OrbitButton>
      </View>
    </GlassCard>
  );

  const renderAwaitingCard = (member: HouseholdMember) => (
    <GlassCard key={member.id} style={styles.card}>
      <View style={styles.memberHeader}>
        <Avatar
          name={member.name}
          emoji={memberDisplayEmoji(member)}
          imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
          size="m"
        />
        <View style={styles.memberCopy}>
          <Text style={[typography.headline, { color: c.text }]}>{member.name}</Text>
          <MemberConnectionCaption member={member} />
          <View style={styles.pillRow}>
            <StatusPill label={formatHouseholdRole(member.role)} tone="amber" />
            {member.joinPreApproved ? <StatusPill label="Trusted" tone="green" /> : null}
          </View>
        </View>
        <MemberConnectionBadge member={member} />
      </View>
      {permissions.canManageHousehold && memberCanReceiveInvite(member) ? (
        <OrbitButton onPress={() => openInvite(member)}>
          {memberUsesProfileInvite(member) ? 'Share Sidekick invite' : 'Share invite'}
        </OrbitButton>
      ) : null}
      <MemberTrustSwitch member={member} />
    </GlassCard>
  );

  const renderConnectedCard = (member: HouseholdMember) => {
    const canManage =
      permissions.canManageHousehold && member.role !== 'owner' && member.id !== currentMember?.id;

    return (
      <Pressable
        key={member.id}
        disabled={!canManage}
        onPress={() => showManageActions(member)}
        accessibilityRole={canManage ? 'button' : undefined}
        accessibilityHint={canManage ? 'Manage member options' : undefined}>
        <GlassCard style={styles.card}>
          <View style={styles.memberHeader}>
            <Avatar
              name={member.name}
              emoji={memberDisplayEmoji(member)}
              imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
              size="m"
            />
            <View style={styles.memberCopy}>
              <Text style={[typography.headline, { color: c.text }]}>{member.name}</Text>
              <MemberConnectionCaption member={member} />
              {member.userId?.trim() ? <HasOwnAccountBadge /> : null}
              {!isSharedDeviceMember(member) ? (
                <Text style={[typography.footnote, { color: c.textMuted }]}>
                  {member.xp} XP · week {member.weekXp ?? 0} · streak {member.streak ?? 0}
                </Text>
              ) : null}
              <View style={styles.pillRow}>
                <StatusPill
                  label={formatHouseholdRole(member.role)}
                  tone={
                    member.role === 'owner'
                      ? 'cyan'
                      : member.role === 'admin'
                        ? 'blue'
                        : member.role === 'shared-device'
                          ? 'green'
                          : 'amber'
                  }
                />
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <MemberConnectionBadge member={member} />
              {canManage ? (
                <MaterialIcons name="more-horiz" size={20} color={c.textMuted} accessibilityLabel="Manage" />
              ) : null}
            </View>
          </View>

          {isSharedDeviceMember(member) ? (
            <View style={styles.sharedBlock}>
              <Text style={[typography.footnote, { color: c.textMuted }]}>People on this device</Text>
              <Text style={[styles.hint, { color: c.textMuted }]}>
                {resolveSharedDevicePeople(member, household.members)
                  .map((person) => person.name)
                  .join(', ') || 'None linked yet.'}
              </Text>
              {permissions.canManageHousehold ? (
                <View style={styles.linkWrap}>
                  {linkCandidates.map((person) => {
                    const linked = (member.sharedWithMemberIds ?? []).includes(person.id);
                    return (
                      <Pressable
                        key={person.id}
                        onPress={() =>
                          toggleSharedLink(member.id, person.id, member.sharedWithMemberIds ?? [])
                        }
                        style={[styles.linkChip, linked && styles.linkChipActive]}>
                        <Text
                          style={[
                            styles.linkChipText,
                            { color: c.textMuted },
                            linked && styles.linkChipTextActive,
                          ]}>
                          {memberDisplayEmoji(person)} {person.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={orbitScreen.content}
        contentInsetAdjustmentBehavior="automatic">
        <View style={orbitScreen.header}>
          <Text style={[typography.footnote, { color: c.textMuted }]}>{household.householdName}</Text>
          <Text style={[typography.title1, { color: c.text }]}>Members</Text>
          <Text style={[typography.body, { color: c.textMuted }]}>{statusLine}</Text>
        </View>

        {pending.length > 0 ? (
          <>
            <SectionHeader title={JOIN_POLICY_COPY.sectionPending} />
            {pending.map(renderPendingCard)}
          </>
        ) : null}

        {permissions.canInviteMembers || permissions.canManageHousehold ? (
          <View style={styles.addBar}>
            <OrbitButton onPress={() => setWizardOpen(true)} style={styles.addPrimary}>
              Add someone
            </OrbitButton>
            {permissions.canInviteMembers ? (
              <OrbitButton tone="secondary" onPress={() => router.push('/invite-household' as never)}>
                Invite adult
              </OrbitButton>
            ) : null}
          </View>
        ) : null}

        {permissions.canManageHousehold ? <MembersJoinPolicyGroup /> : null}

        {showInviteLock ? (
          <GlassCard style={styles.card}>
            <Text style={[typography.headline, { color: c.text }]}>
              {JOIN_POLICY_COPY.everyoneConnectedTitle}
            </Text>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              {JOIN_POLICY_COPY.everyoneConnectedBody}
            </Text>
            <OrbitButton tone="secondary" onPress={() => setJoinApprovalRequired(false)}>
              {JOIN_POLICY_COPY.lockInvitesAction}
            </OrbitButton>
          </GlassCard>
        ) : null}

        {awaiting.length > 0 ? (
          <>
            <SectionHeader
              title={JOIN_POLICY_COPY.sectionNeedsInvite}
              hint={JOIN_POLICY_COPY.sectionNeedsInviteHint}
            />
            {awaiting.map(renderAwaitingCard)}
          </>
        ) : null}

        {connected.length > 0 ? (
          <>
            <SectionHeader title={JOIN_POLICY_COPY.sectionInHousehold} />
            {connected.map(renderConnectedCard)}
          </>
        ) : null}
      </ScrollView>

      {wizardOpen ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, padding: space.lg }]}>
          <SetupMemberWizard
            rewardModel={household.rewardModel ?? DEFAULT_REWARD_MODEL}
            rewardMode={household.rewardMode ?? 'weighted'}
            onCancel={() => setWizardOpen(false)}
            onConfirm={(member: DraftMember) => {
              void (async () => {
                if (!household.id) return;
                try {
                  await addOnboardingMembers(household.id, [
                    {
                      name: member.name,
                      role: member.role === 'admin' ? 'admin' : 'member',
                      avatar: member.avatar,
                      plannedTaskLibraryIds: member.taskLibraryIds,
                    },
                  ]);
                  setWizardOpen(false);
                } catch (err) {
                  Alert.alert(
                    'Could not add member',
                    err instanceof Error ? err.message : 'Try again from Settings → Members.'
                  );
                }
              })();
            }}
          />
        </View>
      ) : null}

      <ProfileInviteSheet
        visible={inviteTarget?.kind === 'profile'}
        member={inviteTarget?.kind === 'profile' ? inviteMember : null}
        householdName={household.householdName}
        onClose={() => setInviteTarget(null)}
      />
      <MemberInviteSheet
        visible={inviteTarget?.kind === 'token'}
        member={inviteTarget?.kind === 'token' ? inviteMember : null}
        householdId={household.id ?? ''}
        adminId={currentMember?.id ?? ''}
        actorIsOwner={currentMember?.role === 'owner'}
        invites={memberInvites}
        onChangeInvites={setMemberInvites}
        onClose={() => setInviteTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  addBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginBottom: space.sm,
  },
  addPrimary: {
    flexGrow: 1,
    minWidth: 140,
  },
  actionsStack: {
    gap: space.sm,
  },
  card: {
    gap: space.md,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  memberCopy: {
    flex: 1,
    gap: space.xs,
  },
  memberHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  sectionHeader: {
    gap: space.xs,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  sharedBlock: {
    gap: space.sm,
  },
  linkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkChipActive: {
    backgroundColor: 'rgba(52,211,153,0.18)',
    borderColor: 'rgba(52,211,153,0.45)',
  },
  linkChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkChipTextActive: {
    color: '#34D399',
  },
});

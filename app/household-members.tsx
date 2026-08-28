import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { MemberInviteSheet } from '@/components/orbit/member-invite-sheet';
import { ProfileInviteSheet } from '@/components/orbit/profile-invite-sheet';
import {
  MemberConnectionBadge,
  MemberConnectionCaption,
  HasOwnAccountBadge,
} from '@/components/orbit/member-connection-badge';
import { SetupMemberWizard } from '@/components/orbit/setup-member-wizard';
import { DEFAULT_REWARD_MODEL } from '@/lib/rewards/reward-model';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import type { MemberInvite } from '@/lib/household/member-invites';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  canPromoteToAdmin,
  familyAdminSeatsLabel,
  getAdminMembers,
  MAX_FAMILY_ADMINS,
  usesFamilyAdminCap,
} from '@/lib/household/admins';
import { adminCapBlockedMessage } from '@/lib/household/admin-cap';
import {
  memberCanReceiveInvite,
  memberUsesProfileInvite,
} from '@/lib/household/member-invite-routing';
import { memberConnectionPhase } from '@/lib/household/member-connection';
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
  if (current === 'owner') {
    return 'owner';
  }
  const cycle = canAdmin ? ROLE_CYCLE : ROLE_CYCLE.filter((role) => role !== 'admin');
  const index = cycle.indexOf(current);
  if (index < 0) {
    return cycle[0] ?? 'adult';
  }
  return cycle[(index + 1) % cycle.length];
}

type InviteTarget =
  | { kind: 'profile'; memberId: string }
  | { kind: 'token'; memberId: string }
  | null;

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
  } = useOrbit();
  const { c } = useOrbitColors();

  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteTarget, setInviteTarget] = useState<InviteTarget>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const pending = household.members.filter((member) => member.status === 'pending');
  const awaiting = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.status !== 'pending' &&
          member.role !== 'owner' &&
          !isSharedDeviceMember(member) &&
          memberConnectionPhase(member) === 'awaiting'
      ),
    [household.members]
  );
  const connected = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.status !== 'pending' &&
          (member.role === 'owner' ||
            isSharedDeviceMember(member) ||
            memberConnectionPhase(member) === 'connected')
      ),
    [household.members]
  );

  const adminSeats = familyAdminSeatsLabel(household.members);
  const admins = getAdminMembers(household.members);
  const familyCap = usesFamilyAdminCap();
  const linkCandidates = sharedDeviceLinkCandidates(household.members);

  const openInvite = (member: HouseholdMember) => {
    if (memberUsesProfileInvite(member)) {
      setInviteTarget({ kind: 'profile', memberId: member.id });
      return;
    }
    setInviteTarget({ kind: 'token', memberId: member.id });
  };

  const inviteMember =
    inviteTarget?.memberId != null
      ? (household.members.find((m) => m.id === inviteTarget.memberId) ?? null)
      : null;

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

  const handleMakeCoAdmin = (memberId: string, name: string) => {
    if (!canPromoteToAdmin(household, memberId)) {
      Alert.alert('Admin seats full', adminCapBlockedMessage(household.members, memberId));
      return;
    }
    Alert.alert('Make co-admin', `Promote ${name} to Admin so they can manage tasks, invites, and approvals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make admin',
        onPress: () => {
          void updateMemberRole(memberId, 'admin').catch((error) => {
            Alert.alert(
              'Couldn’t promote',
              error instanceof Error ? error.message : 'Only two admins per household. Demote someone first.'
            );
          });
        },
      },
    ]);
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
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeMember(memberId);
        },
      },
    ]);
  };

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

  const renderMemberCard = (member: HouseholdMember, options?: { showInvite?: boolean }) => {
    const showInvite =
      options?.showInvite ??
      (permissions.canManageHousehold && memberCanReceiveInvite(member));

    return (
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
            {member.userId?.trim() ? <HasOwnAccountBadge /> : null}
            {!isSharedDeviceMember(member) ? (
              <Text style={[typography.footnote, { color: c.textMuted }]}>
                {member.xp} XP · week {member.weekXp ?? 0} · streak {member.streak ?? 0}
              </Text>
            ) : null}
          </View>
          <MemberConnectionBadge member={member} />
        </View>

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
          {member.status === 'pending' ? (
            <StatusPill label="pending" tone="amber" />
          ) : member.status === 'invited' ? (
            <StatusPill label="invited" tone="amber" />
          ) : (
            <StatusPill label={member.status} tone={member.status === 'active' ? 'green' : 'amber'} />
          )}
        </View>

        {isSharedDeviceMember(member) ? (
          <View style={styles.sharedBlock}>
            <Text style={[typography.footnote, { color: c.textMuted }]}>People on this device</Text>
            <Text style={[styles.hint, { color: c.textMuted }]}>
              {resolveSharedDevicePeople(member, household.members)
                .map((person) => person.name)
                .join(', ') || 'None linked yet — tap names below.'}
            </Text>
            <View style={styles.linkWrap}>
              {linkCandidates.map((person) => {
                const linked = (member.sharedWithMemberIds ?? []).includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    disabled={!permissions.canManageHousehold}
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
          </View>
        ) : null}

        {member.status === 'pending' ? (
          <View style={styles.actions}>
            <OrbitButton
              disabled={!permissions.canManageHousehold}
              onPress={() => handleApproveAs(member.id, false)}>
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
        ) : (
          <View style={styles.actions}>
            {showInvite ? (
              <OrbitButton tone="secondary" onPress={() => openInvite(member)}>
                {memberUsesProfileInvite(member) ? 'Share Sidekick invite' : 'Share invite'}
              </OrbitButton>
            ) : null}
            {permissions.canManageHousehold &&
            member.role !== 'owner' &&
            member.role !== 'admin' &&
            member.role !== 'shared-device' &&
            canPromoteToAdmin(household, member.id) ? (
              <OrbitButton tone="secondary" onPress={() => handleMakeCoAdmin(member.id, member.name)}>
                Make co-admin
              </OrbitButton>
            ) : null}
            {permissions.canManageHousehold && member.role !== 'owner' ? (
              <>
                <OrbitButton
                  tone="secondary"
                  onPress={() => handleChangeRole(member.id, member.role)}>
                  Change role
                </OrbitButton>
                <OrbitButton
                  tone="danger"
                  onPress={() => handleRemove(member.id, member.name, member.role)}>
                  Remove
                </OrbitButton>
              </>
            ) : null}
          </View>
        )}
      </GlassCard>
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
          <Text style={[typography.body, { color: c.textMuted }]}>
            {familyCap
              ? `Families can have two admins (co-parents). ${adminSeats}.`
              : `Approve join requests and manage roles. ${adminSeats}.`}
          </Text>
        </View>

        {permissions.canInviteMembers || permissions.canManageHousehold ? (
          <GlassCard style={styles.card}>
            <Text style={[typography.headline, { color: c.text }]}>Add & invite</Text>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              Create a profile first, then share their invite when you&apos;re ready. One invite per person —
              scan, code, or AirDrop.
            </Text>
            <View style={styles.actions}>
              <OrbitButton onPress={() => setWizardOpen(true)}>Add someone</OrbitButton>
              {permissions.canInviteMembers ? (
                <OrbitButton tone="secondary" onPress={() => router.push('/invite-household' as never)}>
                  Invite adult
                </OrbitButton>
              ) : null}
            </View>
          </GlassCard>
        ) : null}

        {admins.length > 0 ? (
          <GlassCard style={styles.card}>
            <Text style={[typography.headline, { color: c.text }]}>Family admins</Text>
            <Text style={[typography.footnote, { color: c.textMuted }]}>
              {admins.map((member) => `${member.name} (${formatHouseholdRole(member.role)})`).join(' · ')}
            </Text>
            {familyCap && admins.length < MAX_FAMILY_ADMINS ? (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                One admin seat open — promote a partner with Make co-admin.
              </Text>
            ) : null}
          </GlassCard>
        ) : null}

        {pending.length > 0 ? (
          <>
            <Text style={[typography.headline, { color: c.text }]}>Waiting for approval</Text>
            {pending.map((member) => renderMemberCard(member))}
          </>
        ) : null}

        {awaiting.length > 0 ? (
          <>
            <Text style={[typography.headline, { color: c.text }]}>Not connected yet</Text>
            <Text style={[typography.footnote, { color: c.textMuted, marginBottom: space.sm }]}>
              Share each person&apos;s invite so they can join on their device.
            </Text>
            {awaiting.map((member) => renderMemberCard(member, { showInvite: true }))}
          </>
        ) : null}

        {connected.length > 0 ? (
          <>
            <Text style={[typography.headline, { color: c.text }]}>Household</Text>
            {connected.map((member) => renderMemberCard(member))}
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
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

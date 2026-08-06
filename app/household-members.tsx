import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  canPromoteToAdmin,
  familyAdminSeatsLabel,
  getAdminMembers,
  MAX_FAMILY_ADMINS,
  usesFamilyAdminCap,
} from '@/lib/household/admins';
import {
  isSharedDeviceMember,
  resolveSharedDevicePeople,
  sharedDeviceLinkCandidates,
} from '@/lib/household/shared-device';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRole } from '@/types/orbit';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

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

export default function HouseholdMembersScreen() {
  const {
    approveMember,
    createChildInvites,
    createSharedDevice,
    declineMember,
    household,
    permissions,
    removeMember,
    updateMemberRole,
    updateSharedDeviceLinks,
  } = useOrbit();
  const { c } = useOrbitColors();

  const [sharedDeviceName, setSharedDeviceName] = useState('Shared tablet');
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [kidNameOne, setKidNameOne] = useState('');
  const [kidNameTwo, setKidNameTwo] = useState('');
  const [creatingKids, setCreatingKids] = useState(false);
  const [kidStatus, setKidStatus] = useState('');

  const pending = household.members.filter((member) => member.status === 'pending');
  const active = household.members.filter((member) => member.status !== 'pending');
  const adminSeats = familyAdminSeatsLabel(household.members);
  const admins = getAdminMembers(household.members);
  const familyCap = usesFamilyAdminCap();
  const linkCandidates = sharedDeviceLinkCandidates(household.members);

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
          ? `Families can have ${MAX_FAMILY_ADMINS} admins (co-parents). Demote someone first or keep this member as Adult.`
          : 'Cannot promote to admin right now.'
      );
      return;
    }
    void updateMemberRole(memberId, role);
  };

  const handleMakeCoAdmin = (memberId: string, name: string) => {
    if (!canPromoteToAdmin(household, memberId)) {
      Alert.alert(
        'Admin seats full',
        `Families can have ${MAX_FAMILY_ADMINS} co-parent admins. You already have ${admins.map((m) => m.name).join(' & ')}.`
      );
      return;
    }
    Alert.alert('Make co-admin', `Promote ${name} to Admin so they can manage tasks, invites, and approvals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make admin',
        onPress: () => {
          void updateMemberRole(memberId, 'admin');
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

  const handleCreateSharedDevice = () => {
    setCreatingDevice(true);
    void createSharedDevice(sharedDeviceName)
      .then((created) => {
        if (created) {
          setSharedDeviceName('Shared tablet');
        }
      })
      .finally(() => setCreatingDevice(false));
  };

  const handleCreateKidInvites = () => {
    setCreatingKids(true);
    setKidStatus('');
    void createChildInvites([kidNameOne, kidNameTwo])
      .then((created) => {
        setKidNameOne('');
        setKidNameTwo('');
        setKidStatus(
          created.length
            ? `Saved ${created.map((m) => m.name).join(' & ')} on your admin account. Share codes from Invite or their profile QR.`
            : '',
        );
        Alert.alert(
          'Kid invites ready',
          created
            .map((member) => `${member.name}: ${member.profileInviteCode ?? 'code ready'}`)
            .join('\n') + '\n\nAirDrop or share each code. Kids open Get Started → Child — no sign-in.',
        );
      })
      .catch((err: unknown) => {
        setKidStatus(err instanceof Error ? err.message : 'Could not create kid invites.');
      })
      .finally(() => setCreatingKids(false));
  };

  const toggleSharedLink = (deviceId: string, personId: string, linkedIds: string[]) => {
    const next = linkedIds.includes(personId)
      ? linkedIds.filter((id) => id !== personId)
      : [...linkedIds, personId];
    void updateSharedDeviceLinks(deviceId, next);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={typography.footnote}>{household.householdName}</Text>
        <Text style={typography.title1}>Members</Text>
        <Text style={typography.body}>
          {familyCap
            ? `Families can have two admins (co-parents). ${adminSeats}.`
            : `Approve join requests and manage roles. ${adminSeats}.`}
        </Text>
      </View>

      {permissions.canInviteMembers ? (
        <GlassCard style={styles.card}>
          <Text style={typography.headline}>Invite adult</Text>
          <Text style={typography.footnote}>
            They create their own account with this invite and stay pending until you approve.
          </Text>
          <OrbitButton onPress={() => router.push('/invite-household' as never)}>
            Share household invite
          </OrbitButton>
        </GlassCard>
      ) : null}

      {permissions.canInviteMembers || permissions.canManageHousehold ? (
        <GlassCard style={styles.card}>
          <Text style={typography.headline}>Invite kids (no sign-in)</Text>
          <Text style={typography.footnote}>
            Create up to two kid profiles saved on your admin account. AirDrop or send their codes —
            young kids never need email.
          </Text>
          <TextInput
            value={kidNameOne}
            onChangeText={setKidNameOne}
            placeholder="Kid 1 name"
            placeholderTextColor={c.textSubtle}
            style={[styles.deviceInput, { color: c.text }]}
          />
          <TextInput
            value={kidNameTwo}
            onChangeText={setKidNameTwo}
            placeholder="Kid 2 name (optional)"
            placeholderTextColor={c.textSubtle}
            style={[styles.deviceInput, { color: c.text }]}
          />
          <OrbitButton
            disabled={creatingKids || (!kidNameOne.trim() && !kidNameTwo.trim())}
            onPress={handleCreateKidInvites}>
            {creatingKids ? 'Saving…' : 'Create kid invites'}
          </OrbitButton>
          {kidStatus ? <Text style={[styles.hint, { color: c.textMuted }]}>{kidStatus}</Text> : null}
        </GlassCard>
      ) : null}

      {permissions.canManageHousehold ? (
        <GlassCard style={styles.card}>
          <Text style={typography.headline}>Add shared device</Text>
          <Text style={typography.footnote}>
            For a phone or tablet used by several people. Tasks sent here ask which person it&apos;s for (e.g. Clean
            dishes - David).
          </Text>
          <TextInput
            value={sharedDeviceName}
            onChangeText={setSharedDeviceName}
            placeholder="e.g. Kitchen tablet"
            placeholderTextColor={c.textSubtle}
            style={[styles.deviceInput, { color: c.text }]}
          />
          <OrbitButton disabled={creatingDevice || !sharedDeviceName.trim()} onPress={handleCreateSharedDevice}>
            {creatingDevice ? 'Adding…' : 'Add shared device'}
          </OrbitButton>
        </GlassCard>
      ) : null}

      {admins.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={typography.headline}>Family admins</Text>
          <Text style={typography.footnote}>
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
          <Text style={typography.headline}>Pending approval</Text>
          {pending.map((member) => (
            <GlassCard key={member.id} style={styles.card}>
              <View style={styles.memberHeader}>
                <Avatar
                  name={member.name}
                  emoji={memberDisplayEmoji(member)}
                  imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                  size="m"
                />
                <View style={styles.memberCopy}>
                  <Text style={typography.headline}>{member.name}</Text>
                  <Text style={typography.footnote}>
                    Requested {formatHouseholdRole(member.role)} access
                  </Text>
                </View>
              </View>
              <View style={styles.pillRow}>
                <StatusPill label={formatHouseholdRole(member.role)} tone="blue" />
                <StatusPill label="pending" tone="amber" />
              </View>
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
            </GlassCard>
          ))}
        </>
      ) : null}

      <Text style={typography.headline}>Household</Text>
      {active.map((member) => (
        <GlassCard key={member.id} style={styles.card}>
          <View style={styles.memberHeader}>
            <Avatar
              name={member.name}
              emoji={memberDisplayEmoji(member)}
              imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
              size="m"
            />
            <View style={styles.memberCopy}>
              <Text style={typography.headline}>{member.name}</Text>
              <Text style={typography.footnote}>
                {member.xp} XP · week {member.weekXp ?? 0} · streak {member.streak ?? 0}
              </Text>
            </View>
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
            <StatusPill label={member.status} tone={member.status === 'active' ? 'green' : 'amber'} />
          </View>
          {isSharedDeviceMember(member) ? (
            <View style={styles.sharedBlock}>
              <Text style={typography.footnote}>People on this device</Text>
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
          <View style={styles.actions}>
            {permissions.canManageHousehold &&
            member.role !== 'owner' &&
            member.role !== 'admin' &&
            member.role !== 'shared-device' &&
            canPromoteToAdmin(household, member.id) ? (
              <OrbitButton tone="secondary" onPress={() => handleMakeCoAdmin(member.id, member.name)}>
                Make co-admin
              </OrbitButton>
            ) : null}
            <OrbitButton
              disabled={!permissions.canManageHousehold || member.role === 'owner'}
              tone="secondary"
              onPress={() => handleChangeRole(member.id, member.role)}>
              Change Role
            </OrbitButton>
            <OrbitButton
              disabled={!permissions.canManageHousehold || member.role === 'owner'}
              tone="danger"
              onPress={() => handleRemove(member.id, member.name, member.role)}>
              Remove
            </OrbitButton>
          </View>
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  avatar: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderRadius: 22,
    fontSize: 18,
    fontWeight: '900',
    height: 44,
    lineHeight: 44,
    overflow: 'hidden',
    textAlign: 'center',
    width: 44,
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
  deviceInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.card,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    color: orbitColors.success,
  },
});

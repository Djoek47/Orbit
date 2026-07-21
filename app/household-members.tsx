import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
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
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRole } from '@/types/orbit';

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
    createSharedDevice,
    declineMember,
    household,
    permissions,
    removeMember,
    updateMemberRole,
    updateSharedDeviceLinks,
  } = useOrbit();

  const [sharedDeviceName, setSharedDeviceName] = useState('Shared tablet');
  const [creatingDevice, setCreatingDevice] = useState(false);

  const pending = household.members.filter((member) => member.status === 'pending');
  const active = household.members.filter((member) => member.status !== 'pending');
  const adminSeats = familyAdminSeatsLabel(household.members, household.householdType);
  const admins = getAdminMembers(household.members);
  const familyCap = usesFamilyAdminCap(household.householdType);
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
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Members</Text>
        <Text style={orbitTypography.body}>
          {familyCap
            ? `Families can have two admins (co-parents). ${adminSeats}.`
            : `Approve join requests and manage roles. ${adminSeats}.`}
        </Text>
      </View>

      {permissions.canInviteMembers ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>Add new member</Text>
          <Text style={orbitTypography.caption}>
            Share an invite so someone can create their account and join this household. They stay pending until you
            approve.
          </Text>
          <OrbitButton onPress={() => router.push('/invite-household' as never)}>
            Add new member
          </OrbitButton>
        </GlassCard>
      ) : null}

      {permissions.canManageHousehold ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>Add shared device</Text>
          <Text style={orbitTypography.caption}>
            For a phone or tablet used by several people. Tasks sent here ask which person it&apos;s for (e.g. Clean
            dishes - David).
          </Text>
          <TextInput
            value={sharedDeviceName}
            onChangeText={setSharedDeviceName}
            placeholder="e.g. Kitchen tablet"
            placeholderTextColor={orbitColors.textSubtle}
            style={styles.deviceInput}
          />
          <OrbitButton disabled={creatingDevice || !sharedDeviceName.trim()} onPress={handleCreateSharedDevice}>
            {creatingDevice ? 'Adding…' : 'Add shared device'}
          </OrbitButton>
        </GlassCard>
      ) : null}

      {admins.length > 0 ? (
        <GlassCard style={styles.card}>
          <Text style={orbitTypography.cardTitle}>Family admins</Text>
          <Text style={orbitTypography.caption}>
            {admins.map((member) => `${member.name} (${formatHouseholdRole(member.role)})`).join(' · ')}
          </Text>
          {familyCap && admins.length < MAX_FAMILY_ADMINS ? (
            <Text style={styles.hint}>
              One admin seat open — promote a partner with Make co-admin.
            </Text>
          ) : null}
        </GlassCard>
      ) : null}

      {pending.length > 0 ? (
        <>
          <Text style={orbitTypography.cardTitle}>Pending approval</Text>
          {pending.map((member) => (
            <GlassCard key={member.id} style={styles.card}>
              <View style={styles.memberHeader}>
                <Text style={styles.avatar}>{member.avatar}</Text>
                <View style={styles.memberCopy}>
                  <Text style={orbitTypography.cardTitle}>{member.name}</Text>
                  <Text style={orbitTypography.caption}>
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

      <Text style={orbitTypography.cardTitle}>Household</Text>
      {active.map((member) => (
        <GlassCard key={member.id} style={styles.card}>
          <View style={styles.memberHeader}>
            <Text style={styles.avatar}>{member.avatar}</Text>
            <View style={styles.memberCopy}>
              <Text style={orbitTypography.cardTitle}>{member.name}</Text>
              <Text style={orbitTypography.caption}>
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
              <Text style={orbitTypography.caption}>People on this device</Text>
              <Text style={styles.hint}>
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
                      <Text style={[styles.linkChipText, linked && styles.linkChipTextActive]}>
                        {person.avatar} {person.name}
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
    gap: orbitSpacing.md,
  },
  avatar: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderRadius: 22,
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '900',
    height: 44,
    lineHeight: 44,
    overflow: 'hidden',
    textAlign: 'center',
    width: 44,
  },
  card: {
    gap: orbitSpacing.md,
  },
  hint: {
    color: orbitColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  memberCopy: {
    flex: 1,
    gap: orbitSpacing.xs,
  },
  memberHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  deviceInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sharedBlock: {
    gap: orbitSpacing.sm,
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
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  linkChipTextActive: {
    color: orbitColors.success,
  },
});

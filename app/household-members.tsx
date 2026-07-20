import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import {
  canPromoteToAdmin,
  familyAdminSeatsLabel,
  getAdminMembers,
  MAX_FAMILY_ADMINS,
  usesFamilyAdminCap,
} from '@/lib/household/admins';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRole } from '@/types/orbit';

const ROLE_CYCLE: HouseholdRole[] = ['adult', 'admin', 'child', 'guest'];

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
    declineMember,
    household,
    permissions,
    removeMember,
    updateMemberRole,
  } = useOrbit();

  const pending = household.members.filter((member) => member.status === 'pending');
  const active = household.members.filter((member) => member.status !== 'pending');
  const adminSeats = familyAdminSeatsLabel(household.members, household.householdType);
  const admins = getAdminMembers(household.members);
  const familyCap = usesFamilyAdminCap(household.householdType);

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
              tone={member.role === 'owner' ? 'cyan' : member.role === 'admin' ? 'blue' : 'amber'}
            />
            <StatusPill label={member.status} tone={member.status === 'active' ? 'green' : 'amber'} />
          </View>
          <View style={styles.actions}>
            {permissions.canManageHousehold &&
            member.role !== 'owner' &&
            member.role !== 'admin' &&
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
});

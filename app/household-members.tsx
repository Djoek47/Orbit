import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdRole } from '@/types/orbit';

const ROLE_CYCLE: HouseholdRole[] = ['adult', 'admin', 'child', 'guest'];

function nextRole(current: HouseholdRole): HouseholdRole {
  if (current === 'owner') {
    return 'owner';
  }
  const index = ROLE_CYCLE.indexOf(current);
  return ROLE_CYCLE[(index + 1) % ROLE_CYCLE.length];
}

export default function HouseholdMembersScreen() {
  const { approveMember, household, permissions, removeMember, updateMemberRole } = useOrbit();

  const pending = household.members.filter((member) => member.status === 'pending');
  const active = household.members.filter((member) => member.status !== 'pending');

  const handleChangeRole = (memberId: string, currentRole: HouseholdRole) => {
    if (currentRole === 'owner') {
      Alert.alert('Owner role', 'The household owner role cannot be changed here.');
      return;
    }
    const role = nextRole(currentRole);
    void updateMemberRole(memberId, role);
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
          Approve join requests, manage roles, and keep guest access limited.
        </Text>
      </View>

      {pending.length > 0 ? (
        <>
          <Text style={orbitTypography.cardTitle}>Pending approval</Text>
          {pending.map((member) => (
            <GlassCard key={member.id} style={styles.card}>
              <View style={styles.memberHeader}>
                <Text style={styles.avatar}>{member.avatar}</Text>
                <View style={styles.memberCopy}>
                  <Text style={orbitTypography.cardTitle}>{member.name}</Text>
                  <Text style={orbitTypography.caption}>Requested {formatHouseholdRole(member.role)} access</Text>
                </View>
              </View>
              <View style={styles.pillRow}>
                <StatusPill label={formatHouseholdRole(member.role)} tone="blue" />
                <StatusPill label="pending" tone="amber" />
              </View>
              <View style={styles.actions}>
                <OrbitButton
                  disabled={!permissions.canManageHousehold}
                  onPress={() => approveMember(member.id)}>
                  Approve
                </OrbitButton>
                <OrbitButton
                  disabled={!permissions.canManageHousehold}
                  tone="danger"
                  onPress={() => handleRemove(member.id, member.name, member.role)}>
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
            <StatusPill label={formatHouseholdRole(member.role)} tone={member.role === 'owner' ? 'cyan' : 'blue'} />
            <StatusPill label={member.status} tone={member.status === 'active' ? 'green' : 'amber'} />
          </View>
          <View style={styles.actions}>
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

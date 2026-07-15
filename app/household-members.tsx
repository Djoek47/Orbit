import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdMembersScreen() {
  const { household, permissions } = useOrbit();

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Members</Text>
        <Text style={orbitTypography.body}>Roles and status are local placeholders until owner approval is backed by Supabase.</Text>
      </View>

      {household.members.map((member) => (
        <GlassCard key={member.id} style={styles.card}>
          <View style={styles.memberHeader}>
            <Text style={styles.avatar}>{member.avatar}</Text>
            <View style={styles.memberCopy}>
              <Text style={orbitTypography.cardTitle}>{member.name}</Text>
              <Text style={orbitTypography.caption}>{member.xp} XP earned</Text>
            </View>
          </View>
          <View style={styles.pillRow}>
            <StatusPill label={formatHouseholdRole(member.role)} tone={member.role === 'owner' ? 'cyan' : 'blue'} />
            <StatusPill label={member.status} tone={member.status === 'active' ? 'green' : 'amber'} />
          </View>
          <View style={styles.actions}>
            <OrbitButton disabled={!permissions.canManageHousehold} tone="secondary" onPress={() => {}}>
              Change Role
            </OrbitButton>
            <OrbitButton disabled={!permissions.canManageHousehold} tone="danger" onPress={() => {}}>
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

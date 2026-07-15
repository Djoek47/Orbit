import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function HouseholdBalanceScreen() {
  const { household } = useOrbit();
  const sorted = [...household.members].sort((a, b) => b.loadShare - a.loadShare);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Mental load</Text>
        <Text style={orbitTypography.display}>Household balance</Text>
        <Text style={orbitTypography.body}>
          Load share estimates how much coordination each member currently carries.
        </Text>
      </View>

      {sorted.map((member) => (
        <GlassCard key={member.id} style={styles.card}>
          <View style={styles.memberRow}>
            <Text style={styles.avatar}>{member.avatar}</Text>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={orbitTypography.caption}>{member.role} · {member.xp} XP</Text>
              <View style={styles.loadTrack}>
                <View style={[styles.loadFill, { width: `${Math.min(100, member.loadShare)}%` }]} />
              </View>
            </View>
            <Text style={styles.loadText}>{member.loadShare}%</Text>
          </View>
        </GlassCard>
      ))}

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: 'rgba(41, 121, 255, 0.18)',
    borderRadius: 18,
    color: orbitColors.text,
    fontWeight: '800',
    height: 36,
    lineHeight: 36,
    textAlign: 'center',
    width: 36,
  },
  card: {
    gap: orbitSpacing.md,
  },
  loadFill: {
    backgroundColor: orbitColors.novaCyan,
    borderRadius: 999,
    height: 8,
  },
  loadText: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  loadTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  memberInfo: {
    flex: 1,
    gap: 8,
  },
  memberName: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
});

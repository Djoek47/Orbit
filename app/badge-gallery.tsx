import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { ACHIEVEMENT_BADGES } from '@/lib/game-levels';
import { useOrbit } from '@/store/orbit-store';

export default function BadgeGalleryScreen() {
  const { household } = useOrbit();
  const earnedAchievements = ACHIEVEMENT_BADGES.filter((badge) => badge.earned).length;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Collection</Text>
        <Text style={orbitTypography.display}>Badge gallery</Text>
        <Text style={orbitTypography.body}>
          Household badges plus achievement milestones earned across Orbit.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Household badges</Text>
          <StatusPill label={`${household.badges.length}`} tone="cyan" />
        </View>
        {household.badges.length === 0 ? (
          <Text style={orbitTypography.caption}>No household badges yet.</Text>
        ) : (
          household.badges.map((badge) => (
            <View key={badge.id} style={styles.badgeRow}>
              <Text style={styles.badgeIcon}>{badge.icon}</Text>
              <View style={styles.badgeCopy}>
                <Text style={styles.badgeTitle}>{badge.title}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, badge.progress)}%` }]} />
                </View>
              </View>
              <Text style={styles.progressLabel}>{badge.progress}%</Text>
            </View>
          ))
        )}
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={orbitScreen.row}>
          <Text style={orbitTypography.cardTitle}>Achievements</Text>
          <Text style={styles.earnedCount}>
            {earnedAchievements}/{ACHIEVEMENT_BADGES.length}
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {ACHIEVEMENT_BADGES.map((badge) => (
            <View key={badge.id} style={styles.badgeTile}>
              <View style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              </View>
              <Text style={[styles.badgeLabel, !badge.earned && styles.badgeLabelMuted]}>{badge.label}</Text>
              <Text style={orbitTypography.caption}>{badge.description}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badgeCopy: {
    flex: 1,
    gap: 6,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.md,
  },
  badgeIcon: {
    fontSize: 28,
  },
  badgeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  badgeLabel: {
    color: orbitColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeLabelMuted: {
    color: orbitColors.textSubtle,
  },
  badgeLocked: {
    opacity: 0.45,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  badgeTile: {
    gap: 6,
    width: '47%',
  },
  badgeTitle: {
    color: orbitColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    gap: orbitSpacing.md,
  },
  earnedCount: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  progressFill: {
    backgroundColor: '#FBBF24',
    borderRadius: 999,
    height: 8,
  },
  progressLabel: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
});

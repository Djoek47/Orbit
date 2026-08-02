import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  formatXp,
  getLevel,
  nextXpMilestone,
  XP_MILESTONE_TROPHIES,
  xpProgress,
} from '@/lib/game-levels';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const HOUSEHOLD_ICON_MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  school: 'school',
  'local-dining': 'local-dining',
  'workspace-premium': 'workspace-premium',
  star: 'star',
  emoji_events: 'emoji-events',
  'emoji-events': 'emoji-events',
  cleaning: 'cleaning-services',
  'cleaning-services': 'cleaning-services',
  pets: 'pets',
  fitness: 'fitness-center',
  home: 'home',
};

function resolveHouseholdIcon(icon: string): keyof typeof MaterialIcons.glyphMap {
  return HOUSEHOLD_ICON_MAP[icon] ?? 'military-tech';
}

export default function BadgeGalleryScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, achievements, currentMember, household } = useOrbit();
  const { c } = useOrbitColors();
  const habitAchievements = achievements.filter((badge) => badge.kind !== 'xp-trophy');
  const xpTrophies = achievements.filter((badge) => badge.kind === 'xp-trophy');
  const lifetimeXp = currentMember?.xp ?? 0;
  const level = getLevel(lifetimeXp);
  const levelPct = Math.round(xpProgress(lifetimeXp) * 100);
  const nextTrophy = nextXpMilestone(lifetimeXp);
  const householdPct = useMemo(() => {
    if (!household.badges.length) return 0;
    const sum = household.badges.reduce((acc, badge) => acc + badge.progress, 0);
    return Math.round((sum / household.badges.length) * 100);
  }, [household.badges]);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
        <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Back</Text>
      </Pressable>

      <View style={orbitScreen.header}>
        <ChoremaxxLogo size="md" />
        <Text style={[typography.footnote, { marginTop: 8 }]}>Collection</Text>
        <Text style={typography.title1}>Badge gallery</Text>
        <Text style={typography.body}>
          Habit badges plus XP trophies all the way to Most Glorious at 1,000,000 XP.
        </Text>
      </View>

      <GlassCard style={styles.summaryCard}>
        <LinearGradient
          colors={[`${level.color}33`, 'rgba(255,215,0,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGlow}
        />
        <Text style={[styles.summaryTitle, { color: c.textSoft }]}>
          {level.emoji} {level.name}
        </Text>
        <Text style={[styles.summaryPct, { color: level.color }]}>{formatXp(lifetimeXp)} XP</Text>
        <View style={styles.summaryTrack}>
          <LinearGradient
            colors={[level.color, '#FFD700']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.summaryFill, { width: `${levelPct}%` }]}
          />
        </View>
        <Text style={typography.footnote}>
          {nextTrophy
            ? `Next trophy: ${nextTrophy.label} at ${formatXp(nextTrophy.xp)} XP`
            : 'Most Glorious unlocked — you reached 1,000,000 XP'}
        </Text>
      </GlassCard>

      <GlassCard style={styles.summaryCard}>
        <LinearGradient
          colors={[`${accentTheme.primary}22`, 'rgba(251,191,36,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGlow}
        />
        <Text style={[styles.summaryTitle, { color: c.textSoft }]}>Collection progress</Text>
        <Text style={[styles.summaryPct, { color: accentTheme.primary }]}>{householdPct}%</Text>
        <View style={styles.summaryTrack}>
          <LinearGradient
            colors={[accentTheme.primary, '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.summaryFill, { width: `${householdPct}%` }]}
          />
        </View>
        <Text style={typography.footnote}>
          {achievements.filter((badge) => badge.earned).length}/{achievements.length} awards unlocked
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={typography.headline}>Household badges</Text>
        {household.badges.length === 0 ? (
          <Text style={typography.footnote}>No household badges yet.</Text>
        ) : (
          household.badges.map((badge) => {
            const pct = Math.min(100, Math.round(badge.progress * 100));
            const earned = pct >= 100;
            return (
              <View key={badge.id} style={styles.badgeRow}>
                <View
                  style={[
                    styles.householdIconWrap,
                    {
                      backgroundColor: earned ? 'rgba(251,191,36,0.18)' : `${accentTheme.primary}18`,
                      borderColor: earned ? 'rgba(251,191,36,0.45)' : `${accentTheme.primary}33`,
                    },
                  ]}>
                  <MaterialIcons
                    name={resolveHouseholdIcon(badge.icon)}
                    size={22}
                    color={earned ? '#FBBF24' : accentTheme.primary}
                  />
                </View>
                <View style={styles.badgeCopy}>
                  <Text style={[styles.badgeTitle, { color: c.text }]}>{badge.title}</Text>
                  <Text style={[styles.badgeHint, { color: c.textSubtle }]}>
                    {earned ? 'Earned' : 'Keep going — progress counts toward this badge'}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: earned ? '#FBBF24' : accentTheme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.progressLabel, { color: c.textMuted }, earned && { color: '#FBBF24' }]}>
                  {pct}%
                </Text>
              </View>
            );
          })
        )}
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={orbitScreen.row}>
          <Text style={typography.headline}>XP trophies</Text>
          <Text style={styles.earnedCount}>
            {xpTrophies.filter((badge) => badge.earned).length}/{XP_MILESTONE_TROPHIES.length}
          </Text>
        </View>
        <Text style={[typography.footnote, { marginBottom: 8 }]}>
          Awards unlock as lifetime XP climbs — bronze to Most Glorious at one million.
        </Text>
        <View style={styles.badgeGrid}>
          {xpTrophies.map((badge) => (
            <View
              key={badge.id}
              style={[styles.badgeTile, !badge.earned && styles.badgeTileLocked]}>
              <View style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                {!badge.earned ? (
                  <View style={styles.lockOverlay}>
                    <MaterialIcons name="lock" size={12} color={c.textSubtle} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.badgeLabel, { color: c.text }, !badge.earned && { color: c.textSubtle }]}>
                {badge.label}
              </Text>
              <Text style={[styles.badgeDesc, { color: c.textMuted }, !badge.earned && { color: c.textSubtle }]}>
                {badge.earned
                  ? badge.description
                  : `Locked · ${formatXp(badge.xpRequired ?? 0)} XP`}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={orbitScreen.row}>
          <Text style={typography.headline}>Habit achievements</Text>
          <Text style={styles.earnedCount}>
            {habitAchievements.filter((badge) => badge.earned).length}/{habitAchievements.length}
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {habitAchievements.map((badge) => (
            <View
              key={badge.id}
              style={[styles.badgeTile, !badge.earned && styles.badgeTileLocked]}>
              <View style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                {!badge.earned ? (
                  <View style={styles.lockOverlay}>
                    <MaterialIcons name="lock" size={12} color={c.textSubtle} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.badgeLabel, { color: c.text }, !badge.earned && { color: c.textSubtle }]}>
                {badge.label}
              </Text>
              <Text style={[styles.badgeDesc, { color: c.textMuted }, !badge.earned && { color: c.textSubtle }]}>
                {badge.earned ? badge.description : `Locked · ${badge.description}`}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  backLabel: { fontSize: 15, fontWeight: '600' },
  summaryCard: {
    gap: 10,
    overflow: 'hidden',
  },
  summaryGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryPct: {
    fontSize: 32,
    fontWeight: '800',
  },
  summaryTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  summaryFill: {
    borderRadius: 999,
    height: 10,
  },
  badgeCopy: {
    flex: 1,
    gap: 6,
  },
  badgeDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  badgeHint: {
    fontSize: 11,
  },
  badgeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: radius.card,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    position: 'relative',
    width: 52,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeLocked: {
    opacity: 0.45,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  badgeTile: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 6,
    padding: 12,
    width: '47%',
  },
  badgeTileLocked: {
    opacity: 0.72,
  },
  badgeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    gap: space.md,
  },
  earnedCount: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  householdIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(7,13,28,0.35)',
    borderRadius: radius.card,
    justifyContent: 'center',
  },
  progressFill: {
    borderRadius: 999,
    height: 8,
  },
  progressLabel: {
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

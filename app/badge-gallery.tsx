import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import Icon from '@/components/orbit/design/Icon';
import { achievementIconName, trophyIconName } from '@/components/orbit/design/icon-map';
import { tierTone } from '@/components/orbit/design/tierTone';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors, orbitScreen, radius, space } from '@/constants/orbit-theme';
import {
  formatXp,
  getLevel,
  nextXpMilestone,
  XP_MILESTONE_TROPHIES,
  xpProgress,
} from '@/lib/game-levels';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function BadgeGalleryScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, achievements, currentMember } = useOrbit();
  // `type` is the color-aware type scale — bare `typography.*` has NO color and
  // paints system black, which disappears on dark glass (TestFlight feedback).
  const { c, type } = useOrbitColors();
  const habitAchievements = achievements.filter((badge) => badge.kind !== 'xp-trophy');
  const xpTrophies = achievements.filter((badge) => badge.kind === 'xp-trophy');
  const lifetimeXp = currentMember?.xp ?? 0;
  const level = getLevel(lifetimeXp);
  const levelPct = Math.round(xpProgress(lifetimeXp) * 100);
  const nextTrophy = nextXpMilestone(lifetimeXp);
  const collectionPct = useMemo(() => {
    if (!achievements.length) return 0;
    const earned = achievements.filter((badge) => badge.earned).length;
    return Math.round((earned / achievements.length) * 100);
  }, [achievements]);

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: c.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
        <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Back</Text>
      </Pressable>

      <View style={orbitScreen.header}>
        <ChoremaxxLogo size="md" />
        <Text style={[type.footnote, { marginTop: 8, color: c.textMuted }]}>Collection</Text>
        <Text style={[type.title1, { color: c.text }]}>Badge gallery</Text>
        <Text style={[type.body, { color: c.textSoft }]}>
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
          {level.name}
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
        <Text style={[type.footnote, { color: c.textSoft }]}>
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
        <Text style={[styles.summaryPct, { color: accentTheme.primary }]}>{collectionPct}%</Text>
        <View style={styles.summaryTrack}>
          <LinearGradient
            colors={[accentTheme.primary, '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.summaryFill, { width: `${collectionPct}%` }]}
          />
        </View>
        <Text style={[type.footnote, { color: c.textSoft }]}>
          {achievements.filter((badge) => badge.earned).length}/{achievements.length} awards unlocked
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={[type.headline, { color: c.text }]}>Live collection</Text>
        <Text style={[type.footnote, { marginBottom: 8, color: c.textMuted }]}>
          Driven by achievements for {currentMember?.name ?? 'you'} — not static household badge stubs.
        </Text>
        {habitAchievements.map((badge) => {
          const earned = badge.earned;
          return (
            <View key={`live-${badge.id}`} style={styles.badgeRow}>
              <View
                style={[
                  styles.householdIconWrap,
                  {
                    backgroundColor: earned ? 'rgba(251,191,36,0.18)' : `${accentTheme.primary}18`,
                    borderColor: earned ? 'rgba(251,191,36,0.45)' : `${accentTheme.primary}33`,
                  },
                ]}>
                <Icon name={achievementIconName(badge.id)!} size={24} muted={!earned} />
              </View>
              <View style={styles.badgeCopy}>
                <Text style={[styles.badgeTitle, { color: c.text }]}>{badge.label}</Text>
                <Text style={[styles.badgeHint, { color: c.textMuted }]}>
                  {earned ? 'Earned' : badge.description}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: earned ? '100%' : '0%',
                        backgroundColor: earned ? '#FBBF24' : accentTheme.primary,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.progressLabel, { color: c.textMuted }, earned && { color: '#FBBF24' }]}>
                {earned ? '100%' : '0%'}
              </Text>
            </View>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.card}>
        <View style={orbitScreen.row}>
          <Text style={[type.headline, { color: c.text }]}>XP trophies</Text>
          <Text style={styles.earnedCount}>
            {xpTrophies.filter((badge) => badge.earned).length}/{XP_MILESTONE_TROPHIES.length}
          </Text>
        </View>
        <Text style={[type.footnote, { marginBottom: 8, color: c.textMuted }]}>
          Awards unlock as lifetime XP climbs — bronze to Most Glorious at one million.
        </Text>
        <View style={styles.badgeGrid}>
          {xpTrophies.map((badge, index) => (
            <View key={badge.id} style={styles.badgeTile}>
              <View style={styles.badgeIconWrap}>
                <Icon
                  name={trophyIconName(index)}
                  variant="halo"
                  tone={tierTone(index, badge.earned)}
                  muted={!badge.earned}
                  size={44}
                />
              </View>
              <Text style={[styles.badgeLabel, { color: c.text }]}>{badge.label}</Text>
              <Text style={[styles.badgeDesc, { color: c.textMuted }]}>
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
          <Text style={[type.headline, { color: c.text }]}>Habit achievements</Text>
          <Text style={styles.earnedCount}>
            {habitAchievements.filter((badge) => badge.earned).length}/{habitAchievements.length}
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {habitAchievements.map((badge) => (
            <View key={badge.id} style={styles.badgeTile}>
              <View style={styles.badgeIconWrap}>
                <Icon name={achievementIconName(badge.id)!} size={32} muted={!badge.earned} />
              </View>
              <Text style={[styles.badgeLabel, { color: c.text }]}>{badge.label}</Text>
              <Text style={[styles.badgeDesc, { color: c.textMuted }]}>
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

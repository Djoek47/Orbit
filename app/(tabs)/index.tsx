import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { LargeTitleHeader } from '@/components/orbit/large-title-header';
import { Leaderboard, type LeaderboardEntry } from '@/components/orbit/leaderboard';
import { NovaCard } from '@/components/orbit/nova-card';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { PersonaSwitchPopup } from '@/components/orbit/persona-switch-popup';
import { TodayTasksCard } from '@/components/orbit/today-tasks-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import {
  buildHomeHealthMetrics,
  resolveHomeHealthRole,
} from '@/lib/home-health-metrics';
import {
  findSharedDeviceForMember,
  isSharedDeviceAccount,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { greetingWord } from '@/lib/time/greeting';
import { useOrbit } from '@/store/orbit-store';

export default function HomeScreen() {
  const chromePad = useTabChromePaddingTop();
  const { accentTheme, awardDailyStreak, household, metrics, novaBriefing, currentMember, switchPersona, permissions, orbitPalette } =
    useOrbit();
  const { c, glass } = useOrbitColors();
  const [personaSwitchOpen, setPersonaSwitchOpen] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const displayName = currentMember?.name ?? household.greetingName;
  const sharedDevice = findSharedDeviceForMember(currentMember?.id, household.members);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const healthRole = resolveHomeHealthRole(currentMember, {
    householdType: household.householdType,
    isAdmin: permissions.canManageHousehold,
  });
  const healthItems = useMemo(
    () =>
      buildHomeHealthMetrics({
        role: healthRole,
        metrics,
        household,
        currentMember,
      }),
    [healthRole, metrics, household, currentMember],
  );

  const groceryAlerts = household.groceries.filter((g) => g.status === 'Missing' || g.status === 'Low');
  const nextEvent = [
    ...household.events.filter(
      (e) => e.date === 'Today' || (e.startsAt ?? '').startsWith(new Date().toISOString().slice(0, 10))
    ),
    ...household.events,
  ].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)[0];

  const weekLeaders = useMemo<LeaderboardEntry[]>(() => {
    return household.members
      .filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      )
      .map((member) => ({
        id: member.id,
        name: member.name,
        avatarEmoji: memberDisplayEmoji(member),
        avatarImageUri: isAvatarImageUri(member.avatar) ? member.avatar : undefined,
        xp: member.weekXp ?? 0,
      }));
  }, [household.members]);

  const personalWeekXp = currentMember?.weekXp ?? 0;
  const personalTotalXp = currentMember?.xp ?? 0;
  const personalStreak = currentMember?.streak ?? 0;

  return (
    <>
      <Animated.ScrollView
        style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
        contentContainerStyle={[
          orbitScreen.content,
          styles.pageContent,
          { paddingTop: chromePad },
        ]}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        {/* Header — greeting + avatar (persona switch), date eyebrow. Kept per design-system/06. */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <PageEyebrow>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </PageEyebrow>
            <LargeTitleHeader
              title={`${greetingWord()}, ${displayName}`}
              scrollY={scrollY}
              size="compact"
            />
            {sharedDevice ? (
              <Pressable
                onPress={() => {
                  void import('@/lib/device/device-session').then(({ markNeedsProfilePick }) =>
                    markNeedsProfilePick().then(() => router.push('/select-profile' as never))
                  );
                }}
                style={[
                  styles.deviceSwitchChip,
                  { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}66` },
                ]}>
                <Text style={styles.deviceSwitchEmoji}>{sharedDevice.avatar || '📱'}</Text>
                <Text style={[typography.caption1, { color: accentTheme.primary }]}>
                  Switch who&apos;s on · {displayName}
                </Text>
                <MaterialIcons name="expand-more" size={16} color={accentTheme.primary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setPersonaSwitchOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Switch account">
            <Avatar
              name={displayName}
              emoji={currentMember ? memberDisplayEmoji(currentMember) : undefined}
              imageUri={
                currentMember?.avatar && isAvatarImageUri(currentMember.avatar)
                  ? currentMember.avatar
                  : undefined
              }
              size="l"
            />
          </Pressable>
        </View>

        {/* Morning Brief — Apple-Intelligence-style card, not a chat entry point. */}
        <NovaCard
          kind="morningBrief"
          message={novaBriefing.summary}
          actions={[{ label: 'Open Nova', onPress: () => router.push('/(tabs)/nova' as never) }]}
        />

        {/* Today — unified typography-led section (tasks + grocery/event stats together). */}
        <View style={styles.todaySection}>
          <Text style={[typography.title2, { color: orbitPalette.text }]}>Today</Text>
          <TodayTasksCard
            tasks={household.tasks}
            members={household.members}
            currentMember={currentMember}
            accentTheme={accentTheme}
            canFocusMembers={permissions.canManageHousehold}
            mineOnly={sharedKidMode}
            streak={currentMember?.streak ?? 0}
            onAwardDailyStreak={() => {
              void awardDailyStreak();
            }}
          />
          <View style={styles.statRow}>
            <Pressable style={styles.statItem} onPress={() => router.push('/(tabs)/groceries' as never)}>
              <MaterialIcons
                name="shopping-cart"
                size={16}
                color={groceryAlerts.length > 0 ? c.warning : c.textMuted}
              />
              <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]}>
                {groceryAlerts.length > 0 ? `${groceryAlerts.length} low or missing` : 'Groceries stocked'}
              </Text>
            </Pressable>
            <Pressable style={styles.statItem} onPress={() => router.push('/(tabs)/plan' as never)}>
              <MaterialIcons name="calendar-today" size={16} color={c.textMuted} />
              <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]} numberOfLines={1}>
                {nextEvent ? `${nextEvent.title} · ${nextEvent.time}` : 'Nothing on the calendar'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* This week — demoted preview, not competing with Today. */}
        <View style={styles.weekSection}>
          <View style={styles.sectionHead}>
            <Text style={[typography.title3, { color: orbitPalette.text }]}>This week</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/rewards', params: { surface: 'ranks' } } as never)}
              hitSlop={8}>
              <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '700' }]}>
                {sharedKidMode ? 'Rewards' : 'Ranks'}
              </Text>
            </Pressable>
          </View>
          {sharedKidMode ? (
            <View style={styles.personalXpRow}>
              <PersonalStat
                label="This week"
                value={`${personalWeekXp} XP`}
                accent={accentTheme.primary}
                glassBg={glass(0.05)}
                labelColor={orbitPalette.textSoft}
              />
              <PersonalStat
                label="Total"
                value={`${personalTotalXp} XP`}
                accent={accentTheme.primary}
                glassBg={glass(0.05)}
                labelColor={orbitPalette.textSoft}
              />
              <PersonalStat
                label="Streak"
                value={`${personalStreak}d`}
                accent={accentTheme.primary}
                glassBg={glass(0.05)}
                labelColor={orbitPalette.textSoft}
              />
            </View>
          ) : weekLeaders.length > 0 ? (
            <Leaderboard entries={weekLeaders.slice(0, 3)} variant="podium" />
          ) : (
            <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]}>
              No XP yet this week.
            </Text>
          )}
        </View>

        {sharedKidMode ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/rewards', params: { surface: 'rewards' } } as never)
            }
            style={[
              styles.kidRewardCard,
              {
                borderColor: `${accentTheme.primary}44`,
                backgroundColor: glass(0.05),
              },
            ]}>
            <View style={[styles.kidRewardIcon, { backgroundColor: `${accentTheme.primary}22` }]}>
              <MaterialIcons name="card-giftcard" size={22} color={accentTheme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Rewards shop</Text>
              <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]}>
                Spend your XP on treats — you have {personalTotalXp} XP
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={accentTheme.primary} />
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/household-balance' as never)} style={styles.fullBleed}>
          <GlassCard>
            <View style={styles.sectionHead}>
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Household Health</Text>
              <MaterialIcons name="chevron-right" size={16} color={c.textSubtle} />
            </View>
            <View style={styles.healthRow}>
              {healthItems.map((item) => (
                <View key={item.key} style={styles.healthCol}>
                  <View style={styles.healthLabelRow}>
                    <MaterialIcons name={item.icon} size={12} color={item.color} />
                    <Text
                      style={[typography.caption1, styles.healthLabel, { color: orbitPalette.textSoft }]}
                      numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: glass(0.06) }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(4, Math.min(100, item.val))}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={[typography.footnote, styles.healthVal, { color: item.color }]}>
                    {item.valueLabel}
                  </Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </Pressable>
      </Animated.ScrollView>

      <PersonaSwitchPopup
        visible={personaSwitchOpen}
        onClose={() => setPersonaSwitchOpen(false)}
        members={household.members}
        currentMemberId={currentMember?.id ?? ''}
        onSwitch={switchPersona}
      />
    </>
  );
}

function PersonalStat({
  label,
  value,
  accent,
  glassBg,
  labelColor,
}: {
  label: string;
  value: string;
  accent: string;
  glassBg: string;
  labelColor: string;
}) {
  return (
    <View style={[styles.personalXpChip, { borderColor: `${accent}55`, backgroundColor: glassBg }]}>
      <Text style={[typography.caption1, { color: labelColor }]}>{label}</Text>
      <Text style={[typography.metricSmall, { color: accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: space.xl,
    width: '100%',
  },
  headerRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  deviceSwitchChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  deviceSwitchEmoji: { fontSize: 16 },
  fullBleed: { alignSelf: 'stretch', width: '100%' },
  todaySection: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: space.xs,
  },
  weekSection: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personalXpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  personalXpChip: {
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 88,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  kidRewardCard: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  kidRewardIcon: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderCurve: 'continuous',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  healthCol: { alignItems: 'stretch', flex: 1, gap: 6, minWidth: 0 },
  healthLabel: { flexShrink: 1 },
  healthLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  healthRow: { alignSelf: 'stretch', flexDirection: 'row', gap: space.sm, width: '100%' },
  healthVal: { textAlign: 'center' },
  progressFill: {
    borderRadius: radius.full,
    height: '100%',
  },
  progressTrack: {
    borderRadius: radius.full,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
});

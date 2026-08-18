import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { LargeTitleHeader } from '@/components/orbit/large-title-header';
import { Leaderboard, type LeaderboardEntry } from '@/components/orbit/leaderboard';
import { PoppinsCard } from '@/components/orbit/poppins-card';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { StreakRescueSheet } from '@/components/orbit/streak-rescue-sheet';
import { StreakLostSheet } from '@/components/orbit/streak-lost-sheet';
import { TodayTasksCard } from '@/components/orbit/today-tasks-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { VOCAB } from '@/constants/vocabulary';
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
import { isOnRecess } from '@/lib/recess/recess-engine';
import {
  displayTaskXp,
  normalizeRewardSettings,
} from '@/lib/rewards/reward-mode';
import { formatLocalDate } from '@/lib/streaks/local-date';
import { useHouseholdRefresh } from '@/lib/refresh/use-household-refresh';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { greetingWord } from '@/lib/time/greeting';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function HomeScreen() {
  const chromePad = useTabChromePaddingTop();
  const {
    accentTheme,
    awardDailyStreak,
    confirmVerification,
    household,
    markNotDone,
    metrics,
    poppinsBriefing,
    currentMember,
    permissions,
    redeemStreak,
    requestAnotherProof,
    rewardCapabilities,
    v2Permissions,
    orbitPalette,
  } = useOrbit();
  const { refreshing, onRefresh } = useHouseholdRefresh();
  const { c, glass } = useOrbitColors();
  const rewardSettings = useMemo(
    () =>
      normalizeRewardSettings({
        rewardMode: household.rewardMode,
        hygieneRewarded: household.hygieneRewarded,
        hygieneXp: household.hygieneXp,
      }),
    [household.hygieneRewarded, household.hygieneXp, household.rewardMode]
  );
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const displayName = currentMember?.name ?? household.greetingName;
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const pendingApprovals = useMemo(
    () =>
      household.tasks.filter(
        (task) =>
          task.status === 'Completed' &&
          (task.verification === 'unreviewed' || task.verification === 'proof_requested')
      ),
    [household.tasks]
  );
  const sharedDevice = findSharedDeviceForMember(currentMember?.id, household.members);
  const sharedKidMode =
    isSharedDeviceAccount(currentMember, household.members) || currentMember?.role === 'child';
  const healthRole = resolveHomeHealthRole(currentMember, {
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

  const groceryListItems = useMemo(
    () =>
      household.groceries.filter(
        (g) => g.status === 'Missing' || g.status === 'Low' || g.status === 'Purchased'
      ),
    [household.groceries]
  );
  const groceryActive = groceryListItems.filter((g) => g.status !== 'Purchased');
  const groceryCategoryCount = useMemo(() => {
    const cats = new Set(
      groceryActive.map((g) => (g.category || 'Other').trim().toLowerCase()).filter(Boolean)
    );
    return cats.size;
  }, [groceryActive]);
  const grocerySubtitle =
    groceryActive.length === 0
      ? 'List is empty'
      : `${groceryActive.length} item${groceryActive.length === 1 ? '' : 's'} · ${groceryCategoryCount} categor${
          groceryCategoryCount === 1 ? 'y' : 'ies'
        }`;
  const groceryHasNewBadge = useMemo(() => {
    if (!permissions.canManageHousehold && !permissions.canManageGroceries) return false;
    const opened = household.groceriesLastOpenedAt
      ? Date.parse(household.groceriesLastOpenedAt)
      : 0;
    // Badge when there are active items and admin hasn't opened list this session / ever
    return groceryActive.length > 0 && (!opened || Number.isNaN(opened));
  }, [
    groceryActive.length,
    household.groceriesLastOpenedAt,
    permissions.canManageGroceries,
    permissions.canManageHousehold,
  ]);
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

  const todayLocal = formatLocalDate(new Date(), household.timezone);
  const recessPeriods = household.recessPeriods ?? [];
  const selfOnRecess =
    currentMember != null && isOnRecess(recessPeriods, currentMember.id, todayLocal);
  const othersOnRecess = household.members.filter(
    (m) =>
      m.id !== currentMember?.id &&
      isOnRecess(recessPeriods, m.id, todayLocal) &&
      !isSharedDeviceRole(m.role)
  );

  const [rescueVisible, setRescueVisible] = useState(false);
  const [rescueOffer, setRescueOffer] = useState<{
    streakDays: number;
    estimatedXpCost: number;
    freeEligible: boolean;
  } | null>(null);
  const [streakLostVisible, setStreakLostVisible] = useState(false);
  const [streakLost, setStreakLost] = useState<{
    streakDays: number;
    reason: string | null;
  } | null>(null);

  useEffect(() => {
    if (!currentMember) return;
    void import('@/lib/streaks/mock-streak-store').then(({ getMemberStreak }) => {
      const streak = getMemberStreak(currentMember.id);
      if (streak?.pendingRescue) {
        setRescueOffer({
          streakDays: streak.current,
          estimatedXpCost: streak.pendingRescue.estimatedXpCost,
          freeEligible: streak.pendingRescue.freeEligible,
        });
        setRescueVisible(true);
        setStreakLostVisible(false);
        return;
      }
      if (streak?.streakEndedAt && streak.current === 0 && !streak.pendingRescue) {
        setStreakLost({
          streakDays: Math.max(streak.longest ?? 0, 1),
          reason: streak.streakEndedReason ?? null,
        });
        setStreakLostVisible(true);
      }
    });
  }, [currentMember?.id, personalStreak]);

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
        showsVerticalScrollIndicator
        persistentScrollbar
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={accentTheme.primary} />
        }>
        {/* Header — greeting + avatar (persona switch), date eyebrow. Kept per design-system/06. */}
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <PageEyebrow>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </PageEyebrow>
            <LargeTitleHeader
              title={`${greetingWord()}, ${firstName}`}
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
                  Switch who&apos;s on · {firstName}
                </Text>
                <MaterialIcons name="expand-more" size={16} color={accentTheme.primary} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.push('/settings' as never)}
            accessibilityRole="button"
            accessibilityLabel="Open profile settings">
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

        {sharedKidMode ? (
          <Pressable
            onPress={() => router.push('/house-rules' as never)}
            accessibilityRole="button"
            accessibilityLabel={VOCAB.houseRules}>
            <GlassCard>
              <Text style={[typography.headline, { color: orbitPalette.text }]}>{VOCAB.houseRules}</Text>
              <Text style={[typography.footnote, { color: orbitPalette.textSoft, marginTop: 4 }]}>
                How it works
              </Text>
            </GlassCard>
          </Pressable>
        ) : null}

        {selfOnRecess ? (
          <GlassCard>
            <Text style={[typography.body, { color: orbitPalette.text }]}>
              You&apos;re on {VOCAB.recess.toLowerCase()}. Your {personalStreak}-day streak is safe.
            </Text>
          </GlassCard>
        ) : othersOnRecess.length > 0 ? (
          <GlassCard>
            <Text style={[typography.body, { color: orbitPalette.text }]}>
              {othersOnRecess.map((m) => m.name).join(', ')}{' '}
              {othersOnRecess.length === 1 ? 'is' : 'are'} on {VOCAB.recess.toLowerCase()}.
            </Text>
          </GlassCard>
        ) : null}

        {/* Morning Brief — Apple-Intelligence-style card, not a chat entry point. */}
        <PoppinsCard
          kind="morningBrief"
          message={poppinsBriefing.summary}
          actions={[{ label: 'Open Poppins', onPress: () => router.push('/(tabs)/poppins' as never) }]}
        />

        {v2Permissions.canApproveCompletion && pendingApprovals.length > 0 ? (
          <GlassCard style={styles.approvalsCard}>
            <View style={styles.approvalsHead}>
              <Text style={[typography.title2, { color: orbitPalette.text }]}>Approvals</Text>
              <View style={[styles.approvalsBadge, { backgroundColor: accentTheme.primary }]}>
                <Text style={styles.approvalsBadgeText}>{pendingApprovals.length}</Text>
              </View>
            </View>
            <Text style={[typography.footnote, { color: c.textMuted, marginBottom: 8 }]}>
              XP already awarded — confirm or ask for another photo.
            </Text>
            {pendingApprovals.slice(0, 6).map((task) => (
              <View key={task.id} style={styles.approvalRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.headline, { color: orbitPalette.text }]} numberOfLines={1}>
                    {task.assignee} · {task.title}
                  </Text>
                  <Text style={[typography.caption1, { color: c.textMuted }]}>
                    +{displayTaskXp(task, rewardSettings)} XP
                    {task.verification === 'proof_requested' ? ' · waiting on photo' : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void confirmVerification(task.id)}
                  style={[styles.approvalBtn, { backgroundColor: `${accentTheme.primary}22` }]}>
                  <Text style={{ color: accentTheme.primary, fontWeight: '700', fontSize: 12 }}>
                    Confirm
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void requestAnotherProof(task.id)}
                  style={[styles.approvalBtn, { backgroundColor: glass(0.08) }]}>
                  <Text style={{ color: c.textMuted, fontWeight: '700', fontSize: 12 }}>
                    Ask photo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void markNotDone(task.id)}
                  style={[styles.approvalBtn, { backgroundColor: 'rgba(248,113,113,0.12)' }]}>
                  <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 12 }}>
                    Not done
                  </Text>
                </Pressable>
              </View>
            ))}
            {pendingApprovals.length > 1 ? (
              <Pressable
                onPress={() => {
                  void Promise.all(pendingApprovals.map((task) => confirmVerification(task.id)));
                }}
                style={{ marginTop: 8 }}>
                <Text style={{ color: accentTheme.primary, fontWeight: '700' }}>Confirm all</Text>
              </Pressable>
            ) : null}
          </GlassCard>
        ) : null}

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
          <View style={styles.destRow}>
            <Pressable
              style={[
                styles.destCard,
                {
                  borderColor: glass(0.1),
                  backgroundColor: glass(0.05),
                },
              ]}
              onPress={() => router.push('/(tabs)/groceries' as never)}>
              {groceryHasNewBadge ? (
                <View style={[styles.destBadge, { backgroundColor: accentTheme.primary }]} />
              ) : null}
              <MaterialIcons name="shopping-cart" size={28} color={accentTheme.primary} />
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Groceries</Text>
              <Text
                style={[typography.footnote, { color: orbitPalette.textSoft, textAlign: 'center' }]}
                numberOfLines={2}>
                {grocerySubtitle}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.destCard,
                {
                  borderColor: glass(0.1),
                  backgroundColor: glass(0.05),
                },
              ]}
              onPress={() => router.push('/(tabs)/plan' as never)}>
              <MaterialIcons name="calendar-today" size={28} color={accentTheme.primary} />
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Plan</Text>
              <Text
                style={[typography.footnote, { color: orbitPalette.textSoft, textAlign: 'center' }]}
                numberOfLines={2}>
                {nextEvent ? `${nextEvent.title} · ${nextEvent.time}` : 'Nothing on the calendar'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* This week — demoted preview, not competing with Today. */}
        <View style={styles.weekSection}>
          <View style={styles.sectionHead}>
            <Text style={[typography.title3, { color: orbitPalette.text }]}>This week</Text>
            {rewardCapabilities.xpEnabled || rewardCapabilities.rewardsEnabled ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/rewards',
                    params: { surface: rewardCapabilities.xpEnabled ? 'ranks' : 'rewards' },
                  } as never)
                }
                hitSlop={8}>
                <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '700' }]}>
                  {sharedKidMode ? 'Rewards' : 'Ranks'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {sharedKidMode ? (
            <View style={styles.personalXpRow}>
              {rewardCapabilities.xpEnabled ? (
                <>
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
                </>
              ) : null}
              <PersonalStat
                label="Streak"
                value={`${personalStreak}d`}
                accent={accentTheme.primary}
                glassBg={glass(0.05)}
                labelColor={orbitPalette.textSoft}
              />
            </View>
          ) : rewardCapabilities.xpEnabled && weekLeaders.length > 0 ? (
            <Leaderboard entries={weekLeaders.slice(0, 3)} variant="podium" />
          ) : (
            <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]}>
              {rewardCapabilities.xpEnabled ? 'No XP yet this week.' : 'Keep the household rhythm going.'}
            </Text>
          )}
        </View>

        {sharedKidMode && rewardCapabilities.rewardsEnabled ? (
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
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Rewards</Text>
              <Text style={[typography.subheadline, { color: orbitPalette.textSoft }]}>
                Privileges your family set up for you
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
      <StreakRescueSheet
        visible={rescueVisible}
        offer={rescueOffer}
        onAccept={() => {
          void redeemStreak().then(() => {
            setRescueVisible(false);
            setRescueOffer(null);
          });
        }}
        onDecline={() => {
          if (!currentMember) return;
          void import('@/lib/streaks/mock-streak-store').then(({ declineMemberRescue }) => {
            declineMemberRescue(currentMember.id);
            setRescueVisible(false);
            setRescueOffer(null);
          });
        }}
        onDismiss={() => setRescueVisible(false)}
      />
      <StreakLostSheet
        visible={streakLostVisible}
        streakDays={streakLost?.streakDays ?? 0}
        reason={streakLost?.reason}
        onDismiss={() => {
          setStreakLostVisible(false);
          setStreakLost(null);
        }}
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
  approvalsCard: { gap: 8 },
  approvalsHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvalsBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  approvalsBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  approvalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  approvalBtn: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
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
  destRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  destCard: {
    alignItems: 'center',
    aspectRatio: 1,
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    gap: space.xs,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
    position: 'relative',
  },
  destBadge: {
    borderRadius: 5,
    height: 10,
    position: 'absolute',
    right: 12,
    top: 12,
    width: 10,
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

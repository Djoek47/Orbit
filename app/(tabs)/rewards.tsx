import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { ChampionsRecordSheet } from '@/components/orbit/champions-record-sheet';
import { XpLedgerView } from '@/components/orbit/xp-ledger-view';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { CrownLeaderboard } from '@/components/orbit/crown-leaderboard';
import Icon from '@/components/orbit/design/Icon';
import { achievementIconName, trophyIconName } from '@/components/orbit/design/icon-map';
import { tierTone } from '@/components/orbit/design/tierTone';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RewardVaultCard } from '@/components/orbit/reward-vault-card';
import type { IconName } from '@/components/orbit/design/icons';
import { VOCAB } from '@/constants/vocabulary';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  isAvatarImageUri,
  memberDisplayEmoji,
  XP_MILESTONE_TROPHIES,
} from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { isOnRecess } from '@/lib/recess/recess-engine';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import {
  formatMoney,
  listAllowanceLedger,
  summarizeAllowanceLedger,
  type AllowanceLedgerEntry,
} from '@/lib/rewards/ledgers';
import { rankCrownPeriod, type ChampionsRecord } from '@/lib/scoring/crowns';
import { formatLocalDate } from '@/lib/streaks/local-date';
import type { XpLedgerEntry } from '@/lib/streaks/xp-ledger';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type Surface = 'rewards' | 'allowance' | 'ranks';
type RankCat = 'xp' | 'tasks' | 'streak' | 'improved';
type RankingView = 'week' | 'alltime';

/** Podium marks from the ChoreMaxx set (no emoji). */
const RANK_PODIUM: IconName[] = ['tierCrown', 'tierMedal', 'tierMedal'];

const RANK_CATS: { id: RankCat; label: string; icon?: IconName }[] = [
  { id: 'xp', label: 'Most XP' },
  { id: 'tasks', label: 'Most Tasks', icon: 'cleanSweep' },
  { id: 'streak', label: 'Longest Streak', icon: 'weekWarrior' },
  { id: 'improved', label: 'Most Improved' },
];

function resolveSurface(raw?: string | string[]): Surface {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'allowance') return 'allowance';
  if (value === 'ranks' || value === 'rankings') return 'ranks';
  if (value === 'rewards' || value === 'shop') return 'rewards';
  return 'rewards';
}

function AchievementStripIcon({ id, earned }: { id: string; earned: boolean }) {
  const habitName = achievementIconName(id);
  if (habitName) {
    return <Icon name={habitName} size={24} muted={!earned} />;
  }
  const trophyIndex = XP_MILESTONE_TROPHIES.findIndex((trophy) => trophy.id === id);
  if (trophyIndex >= 0) {
    return (
      <Icon
        name={trophyIconName(trophyIndex)}
        variant="halo"
        tone={tierTone(trophyIndex, earned)}
        muted={!earned}
        size={24}
      />
    );
  }
  return null;
}

function completedTaskCount(tasks: HouseholdTask[], memberName: string) {
  return tasks.filter(
    (task) =>
      task.status === 'Completed' &&
      (task.assignee === memberName || task.assignees?.includes(memberName))
  ).length;
}

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} hrs ago`;
  return new Date(iso).toLocaleDateString();
}

function SharedTabletChip({ device }: { device: HouseholdMember }) {
  const { c, glass, glassBorder } = useOrbitColors();
  return (
    <View
      style={[
        styles.deviceChip,
        { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) },
      ]}>
      <Text style={{ fontSize: 11 }}>{device.avatar || '📱'}</Text>
      <Text style={[typography.caption2, { color: c.textMuted }]} numberOfLines={1}>
        {device.name}
      </Text>
    </View>
  );
}

export default function RewardsScreen() {
  const chromePad = useTabChromePaddingTop();
  const params = useLocalSearchParams<{ surface?: string | string[] }>();
  const {
    accentTheme,
    achievements,
    approveAllowance,
    approveRedemption,
    archiveReward,
    household,
    membersWithProgress,
    orbitPalette,
    pendingAllowances,
    pendingRedemptions,
    permissions,
    rejectAllowance,
    rejectRedemption,
    claimReward,
    currentMember,
    requestAllowance,
    rewardCapabilities,
  } = useOrbit();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const isAdmin = permissions.canManageHousehold;
  const canRedeem =
    rewardCapabilities.rewardsEnabled && (isAdmin || caps.allowRewardRedeem);
  const canRequestSpecial =
    rewardCapabilities.rewardsEnabled && (isAdmin || caps.allowSpecialRewardRequest);
  const canApprove = isAdmin || permissions.canApproveReward;
  const showAllowance = rewardCapabilities.allowanceEnabled && caps.allowAllowance;
  const showRewards = rewardCapabilities.rewardsEnabled;
  const showRanks = rewardCapabilities.xpEnabled;

  const [surface, setSurface] = useState<Surface>(() => {
    const resolved = resolveSurface(params.surface);
    if (resolved === 'allowance' && !showAllowance) {
      return showRewards ? 'rewards' : showRanks ? 'ranks' : 'rewards';
    }
    if (resolved === 'rewards' && !showRewards) {
      return showRanks ? 'ranks' : showAllowance ? 'allowance' : 'rewards';
    }
    if (resolved === 'ranks' && !showRanks) {
      return showRewards ? 'rewards' : showAllowance ? 'allowance' : 'ranks';
    }
    return resolved;
  });
  const [rankCat, setRankCat] = useState<RankCat>('xp');
  const [view, setView] = useState<RankingView>('week');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [allowanceBusy, setAllowanceBusy] = useState(false);
  const [championsRecord, setChampionsRecord] = useState<ChampionsRecord | null>(null);
  const [allowanceLedger, setAllowanceLedger] = useState<AllowanceLedgerEntry[]>([]);
  const [ledgerMemberId, setLedgerMemberId] = useState<string | null>(null);

  const reloadAllowanceLedger = useCallback(async () => {
    if (!household.id) {
      setAllowanceLedger([]);
      return;
    }
    const rows = await listAllowanceLedger(household.id);
    setAllowanceLedger(rows);
  }, [household.id]);

  useEffect(() => {
    if (surface === 'allowance') void reloadAllowanceLedger();
  }, [surface, reloadAllowanceLedger, pendingAllowances]);

  const fallbackSurface = (): Surface => {
    if (showRewards) return 'rewards';
    if (showRanks) return 'ranks';
    if (showAllowance) return 'allowance';
    return 'rewards';
  };

  useEffect(() => {
    if (params.surface === undefined) return;
    const next = resolveSurface(params.surface);
    if (next === 'allowance' && !showAllowance) {
      setSurface(fallbackSurface());
      return;
    }
    if (next === 'rewards' && !showRewards) {
      setSurface(fallbackSurface());
      return;
    }
    if (next === 'ranks' && !showRanks) {
      setSurface(fallbackSurface());
      return;
    }
    setSurface(next);
  }, [params.surface, showAllowance, showRanks, showRewards]);

  useEffect(() => {
    if (
      (surface === 'allowance' && !showAllowance) ||
      (surface === 'rewards' && !showRewards) ||
      (surface === 'ranks' && !showRanks)
    ) {
      setSurface(fallbackSurface());
    }
  }, [showAllowance, showRanks, showRewards, surface]);

  const selectSurface = (next: Surface) => {
    if (next === 'allowance' && !showAllowance) return;
    if (next === 'rewards' && !showRewards) return;
    if (next === 'ranks' && !showRanks) return;
    setSurface(next);
    router.setParams({ surface: next } as never);
  };

  const vaultMembers = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      ),
    [household.members]
  );

  const catalogRewards = useMemo(() => {
    return household.rewards.filter((reward) => {
      if (reward.archived) return false;
      if (
        !isAdmin &&
        reward.assignedMemberId &&
        reward.assignedMemberId !== currentMember?.id
      ) {
        return false;
      }
      return true;
    });
  }, [currentMember?.id, household.rewards, isAdmin]);

  const ranked = useMemo(() => {
    const base = [...membersWithProgress].filter(
      (member) =>
        member.status === 'active' &&
        member.role !== 'guest' &&
        !isSharedDeviceRole(member.role)
    );
    return base.sort((a, b) => {
      if (rankCat === 'tasks') {
        return (
          completedTaskCount(household.tasks, b.name) -
          completedTaskCount(household.tasks, a.name)
        );
      }
      if (rankCat === 'streak') {
        return (b.streak ?? 0) - (a.streak ?? 0);
      }
      // xp + improved (weekXp proxy)
      if (rankCat === 'improved' || view === 'week') {
        return (b.weekXp ?? 0) - (a.weekXp ?? 0);
      }
      return b.xp - a.xp;
    });
  }, [household.tasks, membersWithProgress, rankCat, view]);

  const todayLocal = formatLocalDate(new Date(), household.timezone);
  const weekCrown = useMemo(() => {
    if (rankCat !== 'xp' || view !== 'week') return null;
    const competitors = ranked.map((m) => ({
      memberId: m.id,
      name: m.name,
      onRecess: isOnRecess(household.recessPeriods ?? [], m.id, todayLocal),
      tasksCompleted: completedTaskCount(household.tasks, m.name),
      lateCount: 0,
    }));
    // Mock week standings from weekXp until ledger is fully hydrated in store.
    const ledger = ranked.flatMap((m) =>
      (m.weekXp ?? 0) > 0
        ? [
            {
              id: `mock_${m.id}`,
              memberId: m.id,
              occurredAt: new Date().toISOString(),
              type: 'task_completed' as const,
              delta: m.weekXp ?? 0,
              balanceAfter: m.xp,
              label: 'Week XP',
            },
          ]
        : []
    );
    return rankCrownPeriod({
      ledger,
      competitors,
      fromIso: new Date(Date.now() - 7 * 86400000).toISOString(),
      toIso: new Date().toISOString(),
    });
  }, [rankCat, view, ranked, household.recessPeriods, household.tasks, todayLocal]);

  const metricFor = (member: (typeof ranked)[number]) => {
    if (rankCat === 'tasks') return completedTaskCount(household.tasks, member.name);
    if (rankCat === 'streak') return member.streak ?? 0;
    if (rankCat === 'improved' || view === 'week') return member.weekXp ?? 0;
    return member.xp;
  };

  const metricSuffix =
    rankCat === 'tasks' ? 'tasks' : rankCat === 'streak' ? 'days' : 'XP';

  const deviceByMemberId = useMemo(() => {
    const map = new Map<string, HouseholdMember>();
    for (const member of ranked) {
      const device = findSharedDeviceForMember(member.id, household.members);
      if (device) map.set(member.id, device);
    }
    return map;
  }, [household.members, ranked]);

  const earnedCount = achievements.filter((badge) => badge.earned).length;
  const top3 = ranked.slice(0, 3);
  // Podium display order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeights = [100, 130, 80];

  const allowanceRows = useMemo(() => {
    return vaultMembers.map((member) => {
      const owed = allowanceLedger.filter(
        (g) => g.memberId === member.id && g.status === 'owed'
      );
      const paid = allowanceLedger.filter(
        (g) => g.memberId === member.id && g.status === 'paid'
      );
      return {
        member,
        owedCount: owed.length,
        paidCount: paid.length,
        owedTotal: owed.reduce((sum, e) => sum + e.amount, 0),
        latestOwed: owed[0],
      };
    });
  }, [allowanceLedger, vaultMembers]);

  const allowanceWeekStats = useMemo(
    () => summarizeAllowanceLedger(allowanceLedger),
    [allowanceLedger]
  );

  const ledgerEntries = useMemo((): XpLedgerEntry[] => {
    if (!ledgerMemberId) return [];
    const member = household.members.find((m) => m.id === ledgerMemberId);
    if (!member) return [];
    const rows: XpLedgerEntry[] = [];
    let balance = 0;
    const completed = [...household.tasks]
      .filter(
        (t) =>
          t.status === 'Completed' &&
          (t.assignee === member.name || t.assignees?.includes(member.name)) &&
          t.completedAt
      )
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
    for (const task of completed) {
      const delta = task.awardedXp ?? task.baseXp ?? 0;
      balance += delta;
      rows.push({
        id: `xp_${task.id}`,
        memberId: member.id,
        occurredAt: task.completedAt!,
        type: task.completedLate ? 'late_credit' : 'task_completed',
        delta,
        balanceAfter: balance,
        label: task.title,
        occurrenceId: task.id,
      });
    }
    return rows.reverse();
  }, [household.members, household.tasks, ledgerMemberId]);

  const fullXpByOccurrence = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of household.tasks) {
      if (typeof task.baseXp === 'number') map[task.id] = task.baseXp;
    }
    return map;
  }, [household.tasks]);

  const surfaceTabs = (
    [
      { id: 'rewards' as const, label: 'Rewards', show: showRewards },
      { id: 'allowance' as const, label: 'Allowance', show: showAllowance },
      { id: 'ranks' as const, label: 'Rankings', show: showRanks },
    ] as const
  ).filter((t) => t.show);

  const handleClaim = async (rewardId: string) => {
    setClaimingId(rewardId);
    try {
      const result = await claimReward(rewardId);
      if (!result) {
        Alert.alert('Couldn’t claim', 'Try again in a moment.');
        return;
      }
      if (result === 'requested') {
        Alert.alert(
          'Request sent',
          'An admin was notified. You’ll hear back when it’s approved.'
        );
      }
    } finally {
      setClaimingId(null);
    }
  };

  const askAllowance = () => {
    setAllowanceBusy(true);
    void requestAllowance({
      amountLabel: '$5',
      note: isAdmin ? 'Admin test allowance ask' : 'Weekly allowance ask',
    })
      .then((grant) => {
        if (grant) {
          Alert.alert('Allowance requested', 'An admin was notified to approve.');
        }
      })
      .finally(() => setAllowanceBusy(false));
  };

  return (
    <>
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator
      persistentScrollbar>
      <View style={[orbitScreen.header, styles.header]}>
        <PageEyebrow>Rewards & Rankings</PageEyebrow>
        <Text style={[typography.title1, { color: orbitPalette.text }]}>
          {currentMember?.role === 'child' ? 'My Rewards' : 'Rewards Center'}
        </Text>
      </View>

      {/* Segmented surfaces */}
      <View style={[styles.segment, { backgroundColor: glass(0.06) }]}>
        {surfaceTabs.map((tab) => {
          const active = surface === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => selectSurface(tab.id)}
              style={[
                styles.segmentChip,
                active && {
                  backgroundColor: `${accentTheme.primary}33`,
                  borderColor: `${accentTheme.primary}55`,
                },
              ]}>
              <Text
                style={[
                  typography.subheadline,
                  { color: c.textSubtle, textAlign: 'center' },
                  active && { color: accentTheme.primary, fontWeight: '700' },
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── REWARDS ── */}
      {surface === 'rewards' ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.stack}>
          {canApprove && pendingRedemptions.length > 0 ? (
            <View
              style={[
                styles.pendingBlock,
                {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.1)',
                  borderColor: 'rgba(245,158,11,0.28)',
                },
              ]}>
              <View style={styles.pendingHead}>
                <Text style={{ fontSize: 16 }}>🔔</Text>
                <Text style={[typography.headline, { color: '#F59E0B' }]}>Pending Approvals</Text>
              </View>
              {pendingRedemptions.map((redemption) => {
                const reward = household.rewards.find((item) => item.id === redemption.rewardId);
                const member = household.members.find((item) => item.id === redemption.memberId);
                return (
                  <View key={redemption.id} style={styles.pendingRow}>
                    <Text style={{ fontSize: 22 }}>
                      {memberDisplayEmoji(member ?? { name: '?', avatar: reward?.emoji })}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                        {member?.name ?? 'Member'} wants {reward?.title ?? 'a reward'}
                      </Text>
                      <Text style={[typography.caption1, { color: c.textSubtle }]}>
                        {reward?.frequency
                          ? `${reward.frequency[0].toUpperCase()}${reward.frequency.slice(1)}`
                          : 'Reward'}{' '}
                        · {relativeTime(redemption.requestedAt)}
                      </Text>
                    </View>
                    <View style={styles.pendingActions}>
                      <Pressable
                        onPress={() => void approveRedemption(redemption.id)}
                        style={[styles.approveBtn, { backgroundColor: 'rgba(52,211,153,0.2)' }]}>
                        <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 12 }}>
                          Approve
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void rejectRedemption(redemption.id)}
                        style={[styles.approveBtn, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                        <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 12 }}>
                          Deny
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.vaultGrid}>
            {catalogRewards.map((reward, index) => {
              return (
                <Animated.View
                  key={reward.id}
                  entering={FadeInUp.delay(index * 40).springify()}
                  style={styles.vaultCell}>
                  <RewardVaultCard
                    reward={reward}
                    accent={accentTheme.primary}
                    canRedeem={canRedeem}
                    canAfford
                    busy={claimingId === reward.id}
                    isAdmin={isAdmin}
                    statusLabel={isAdmin && !canRedeem ? 'Active' : undefined}
                    onClaim={() => handleClaim(reward.id)}
                    onArchive={
                      isAdmin ? () => void archiveReward(reward.id) : undefined
                    }
                  />
                </Animated.View>
              );
            })}
          </View>

          {isAdmin ? (
            <Pressable
              onPress={() => router.push('/create-reward' as never)}
              style={[
                styles.createDashed,
                { borderColor: glassBorder(0.14), backgroundColor: glass(0.04) },
              ]}>
              <MaterialIcons name="add" size={18} color={c.textSubtle} />
              <Text style={[typography.subheadline, { color: c.textSubtle, fontWeight: '600' }]}>
                {VOCAB.mintAReward}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.secondaryLinks}>
            {isAdmin ? (
              <Pressable onPress={() => router.push('/reward-tally' as never)}>
                <Text style={[typography.footnote, { color: accentTheme.primary }]}>
                  Reward history →
                </Text>
              </Pressable>
            ) : null}
            {canRequestSpecial ? (
              <Pressable onPress={() => router.push('/special-reward-request' as never)}>
                <Text style={[typography.footnote, { color: accentTheme.primary }]}>
                  Ask for a reward →
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {/* ── ALLOWANCE ── */}
      {surface === 'allowance' && showAllowance ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.stack}>
          {isAdmin ? (
            <>
              <View
                style={[
                  styles.allowanceSummaryCard,
                  {
                    backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.1)',
                    borderColor: 'rgba(245,158,11,0.28)',
                  },
                ]}>
                <View style={styles.pendingHead}>
                  <MaterialIcons name="payments" size={16} color="#F59E0B" />
                  <Text style={[typography.headline, { color: '#F59E0B' }]}>
                    This week
                  </Text>
                </View>
                <Text style={[typography.caption1, { color: c.textSubtle, marginBottom: 8 }]}>
                  ChoreMaxx keeps the record. You hand over the money however you normally do.
                </Text>
                <View style={styles.allowanceSummaryRow}>
                  <View>
                    <Text style={[typography.title2, { color: c.text }]}>
                      {formatMoney(allowanceWeekStats.owed, allowanceWeekStats.currency)}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textSubtle }]}>Owed</Text>
                  </View>
                  <View>
                    <Text style={[typography.title2, { color: '#34D399' }]}>
                      {formatMoney(allowanceWeekStats.paid, allowanceWeekStats.currency)}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textSubtle }]}>Paid this week</Text>
                  </View>
                </View>
              </View>

              {allowanceRows.map(({ member, owedCount, owedTotal, latestOwed }, i) => (
                <Animated.View
                  key={member.id}
                  entering={FadeInUp.delay(i * 50)}
                  style={[
                    styles.allowanceCard,
                    {
                      backgroundColor: glassFill(isDark),
                      borderColor: glassBorder(0.08),
                    },
                  ]}>
                  <View style={styles.allowanceHead}>
                    <Avatar
                      name={member.name}
                      emoji={memberDisplayEmoji(member)}
                      imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                      size="m"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.headline, { color: c.text }]}>{member.name}</Text>
                      <Text style={[typography.caption1, { color: c.textSubtle }]}>
                        {member.streak ?? 0}-day streak
                        {owedCount > 0
                          ? ` · ${formatMoney(owedTotal, allowanceWeekStats.currency)} owed`
                          : ''}
                      </Text>
                    </View>
                    <Text style={[typography.title3, { color: '#34D399' }]}>
                      {latestOwed?.amountLabel ??
                        (owedTotal > 0
                          ? formatMoney(owedTotal, allowanceWeekStats.currency)
                          : '—')}
                    </Text>
                  </View>
                  <View style={styles.allowanceActions}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/grant-allowance',
                          params: { memberId: member.id },
                        } as never)
                      }
                      style={[styles.allowBtn, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                      <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 12 }}>
                        + Bonus
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const pending = pendingAllowances.find(
                          (g) => g.memberId === member.id && g.status === 'pending'
                        );
                        if (pending) {
                          void approveAllowance(pending.id).then(() => reloadAllowanceLedger());
                          return;
                        }
                        // No pending row — open prefilled grant (bonus / ad-hoc paid).
                        router.push({
                          pathname: '/grant-allowance',
                          params: { memberId: member.id },
                        } as never);
                      }}
                      style={[styles.allowBtn, { backgroundColor: `${accentTheme.primary}22` }]}>
                      <Text style={{ color: accentTheme.primary, fontWeight: '700', fontSize: 12 }}>
                        {VOCAB.markAsPaid}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/allowance-history' as never)}
                      style={[styles.allowBtn, { backgroundColor: glass(0.06) }]}>
                      <Text style={{ color: c.textMuted, fontWeight: '600', fontSize: 12 }}>
                        History
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ))}

              {canApprove &&
                pendingAllowances
                  .filter((g) => g.status === 'pending')
                  .map((grant) => (
                    <View
                      key={grant.id}
                      style={[
                        styles.pendingCard,
                        {
                          backgroundColor: glassFill(isDark),
                          borderColor: glassBorder(0.08),
                        },
                      ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: c.text }]}>
                          {grant.amountLabel}
                        </Text>
                        <Text style={[typography.caption1, { color: c.textMuted }]}>
                          {grant.memberName}
                          {grant.note ? ` · ${grant.note}` : ''}
                        </Text>
                      </View>
                      <View style={styles.pendingActions}>
                        <Pressable
                          onPress={() => {
                            void approveAllowance(grant.id).then(() => reloadAllowanceLedger());
                          }}
                          style={[styles.approveBtn, { backgroundColor: 'rgba(52,211,153,0.2)' }]}>
                          <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 12 }}>
                            {VOCAB.markAsPaid}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void rejectAllowance(grant.id)}
                          style={[styles.approveBtn, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                          <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 12 }}>
                            Deny
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
            </>
          ) : (
            <GlassCard style={styles.stack}>
              <Text style={[typography.headline, { color: c.text }]}>Your allowance</Text>
              <Text style={[typography.footnote, { color: c.textMuted }]}>
                Ask a grown-up when allowance is due. They mark it paid here.
              </Text>
              <Pressable
                disabled={allowanceBusy}
                onPress={askAllowance}
                style={[
                  styles.askBtn,
                  { backgroundColor: `${accentTheme.primary}22`, borderColor: `${accentTheme.primary}55` },
                ]}>
                <MaterialIcons name="payments" size={18} color={accentTheme.primary} />
                <Text style={{ color: accentTheme.primary, fontWeight: '700' }}>
                  {allowanceBusy ? 'Asking…' : 'Ask for allowance'}
                </Text>
              </Pressable>
              {pendingAllowances
                .filter((g) => g.memberId === currentMember?.id)
                .map((grant) => (
                  <Text key={grant.id} style={[typography.footnote, { color: c.textSoft }]}>
                    {grant.amountLabel} · {grant.status}
                  </Text>
                ))}
            </GlassCard>
          )}
        </Animated.View>
      ) : null}

      {/* ── RANKINGS ── */}
      {surface === 'ranks' ? (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.stack}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rankCatRow}>
            {RANK_CATS.map((cat) => {
              const active = rankCat === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setRankCat(cat.id)}
                  style={[
                    styles.rankCatChip,
                    {
                      backgroundColor: active ? `${accentTheme.primary}33` : glass(0.05),
                      borderColor: active ? `${accentTheme.primary}55` : glassBorder(0.1),
                    },
                  ]}>
                  {cat.icon ? <Icon name={cat.icon} size={20} /> : null}
                  <Text
                    style={[
                      typography.caption1,
                      { color: active ? accentTheme.primary : c.textSubtle, fontWeight: active ? '700' : '500' },
                    ]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {rankCat === 'xp' ? (
            <View style={[styles.toggleRow, { backgroundColor: glass(0.06) }]}>
              {(['week', 'alltime'] as const).map((option) => {
                const active = view === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setView(option)}
                    style={[
                      styles.toggleButton,
                      active && {
                        backgroundColor: `${accentTheme.primary}28`,
                      },
                    ]}>
                    <Text
                      style={[
                        typography.footnote,
                        { color: active ? accentTheme.primary : c.textSubtle, fontWeight: active ? '700' : '500' },
                      ]}>
                      {option === 'week' ? VOCAB.weeksCrown : 'All Time'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {weekCrown ? (
            <GlassCard style={{ paddingVertical: 8 }}>
              <Text style={[typography.caption1, { color: c.textMuted, marginBottom: 8 }]}>
                {VOCAB.weeksCrown}
              </Text>
              <CrownLeaderboard
                rows={weekCrown.rows}
                emptyCopy={weekCrown.emptyCopy}
                onSelect={(memberId) => {
                  const row = weekCrown.rows.find((r) => r.memberId === memberId);
                  const member = ranked.find((m) => m.id === memberId);
                  if (!row || !member) return;
                  setChampionsRecord({
                    memberId,
                    name: member.name,
                    rank: row.rank,
                    medal: row.medal,
                    netXp: row.netXp,
                    tasksCompleted: completedTaskCount(household.tasks, member.name),
                    onTimeCount: completedTaskCount(household.tasks, member.name),
                    currentStreak: member.streak ?? 0,
                    bestDayLabel: null,
                    busiestDomain: null,
                    lateCount: 0,
                    expiredCount: 0,
                    streakRescuesUsed: 0,
                  });
                }}
              />
            </GlassCard>
          ) : (
          <View
            style={[
              styles.podiumCard,
              {
                backgroundColor: glassFill(isDark, 0.04),
                borderColor: glassBorder(0.1),
              },
            ]}>
            <LinearGradient
              colors={[`${accentTheme.primary}18`, `${accentTheme.secondary}10`, 'transparent']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.podiumRow}>
              {podiumOrder.map((member, i) => {
                if (!member) return null;
                const displayIdx = i === 0 ? 1 : i === 1 ? 0 : 2;
                const val = metricFor(member);
                const height = podiumHeights[i] ?? 80;
                return (
                  <Animated.View
                    key={member.id}
                    entering={FadeInUp.delay(i * 80)}
                    style={styles.podiumItem}>
                    {displayIdx === 0 ? <Text style={{ fontSize: 18 }}>👑</Text> : null}
                    <Avatar
                      name={member.name}
                      emoji={member.avatarEmoji}
                      imageUri={
                        isAvatarImageUri(member.avatar) ? member.avatar : undefined
                      }
                      size={displayIdx === 0 ? 'l' : 'm'}
                    />
                    <Text style={[typography.caption1, { color: c.text, fontWeight: '600' }]}>
                      {member.name}
                    </Text>
                    <View
                      style={[
                        styles.podiumBar,
                        {
                          height,
                          backgroundColor: `${member.accentColor}22`,
                          borderColor: `${member.accentColor}44`,
                        },
                      ]}>
                      <Text
                        style={{
                          color: member.accentColor,
                          fontWeight: '800',
                          fontSize: displayIdx === 0 ? 14 : 12,
                        }}>
                        {val}
                        {rankCat === 'xp' || rankCat === 'improved' ? ' XP' : ''}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
          )}

          {!weekCrown ? (
          <GlassCard style={{ paddingVertical: 4 }}>
            {ranked.map((member, index) => {
              const val = metricFor(member);
              const top = metricFor(ranked[0]!) || 1;
              const pct = Math.max(8, Math.round((val / top) * 100));
              return (
                <View
                  key={member.id}
                  style={[
                    styles.rankRow,
                    index < ranked.length - 1 && {
                      borderBottomColor: glassBorder(0.05),
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  {index < 3 ? (
                    <Icon name={RANK_PODIUM[index]} size={20} />
                  ) : (
                    <Text style={[styles.rankBadge, { color: c.textSubtle }]}>#{index + 1}</Text>
                  )}
                  <Avatar
                    name={member.name}
                    emoji={member.avatarEmoji}
                    imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                    size="s"
                  />                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.nameRow}>
                      <Text style={[typography.subheadline, { color: c.text, fontWeight: '600' }]}>
                        {member.name}
                      </Text>
                      {deviceByMemberId.get(member.id) ? (
                        <SharedTabletChip device={deviceByMemberId.get(member.id)!} />
                      ) : null}
                      <View
                        style={[
                          styles.levelPill,
                          { backgroundColor: `${member.levelColor}18` },
                        ]}>
                        <Text style={{ color: member.levelColor, fontSize: 9, fontWeight: '700' }}>
                          {member.levelName}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.miniTrack, { backgroundColor: glass(0.08) }]}>
                      <View
                        style={[
                          styles.miniFill,
                          { width: `${pct}%`, backgroundColor: member.accentColor },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        color: index === 0 ? c.rankGold : accentTheme.primary,
                        fontWeight: '800',
                        fontSize: 16,
                      }}>
                      {val}
                    </Text>
                    <Text style={[typography.caption2, { color: c.textSubtle }]}>
                      {metricSuffix}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>
          ) : null}

          <Pressable onPress={() => router.push('/badge-gallery' as never)}>
            <GlassCard>
              <View style={styles.achievementsHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="auto-awesome" size={16} color="#F59E0B" />
                  <Text style={[typography.headline, { color: c.text }]}>Achievements</Text>
                </View>
                <Text style={[typography.caption1, { color: '#34D399', fontWeight: '600' }]}>
                  {earnedCount}/{achievements.length} earned
                </Text>
              </View>
              <View style={styles.badgeRow}>
                {achievements
                  .filter((b) => b.earned)
                  .slice(0, 8)
                  .map((b) => (
                    <View
                      key={b.id}
                      style={[
                        styles.badgeTile,
                        {
                          backgroundColor: 'rgba(245,158,11,0.12)',
                          borderColor: 'rgba(245,158,11,0.28)',
                        },
                      ]}>
                      <AchievementStripIcon id={b.id} earned />
                    </View>
                  ))}
                {achievements
                  .filter((b) => !b.earned)
                  .slice(0, 2)
                  .map((b) => (
                    <View
                      key={b.id}
                      style={[
                        styles.badgeTile,
                        {
                          backgroundColor: glass(0.04),
                          borderColor: glassBorder(0.08),
                          opacity: 0.35,
                        },
                      ]}>
                      <AchievementStripIcon id={b.id} earned={false} />
                    </View>
                  ))}
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>
      ) : null}
    </ScrollView>
      <ChampionsRecordSheet
        visible={championsRecord != null}
        record={championsRecord}
        viewer={{
          memberId: currentMember?.id ?? '',
          isAdmin,
        }}
        periodLabel={VOCAB.weeksCrown}
        onClose={() => setChampionsRecord(null)}
        onOpenLedger={() => {
          if (championsRecord?.memberId) {
            setLedgerMemberId(championsRecord.memberId);
          }
        }}
      />
      <BottomSheet
        visible={ledgerMemberId != null}
        onDismiss={() => setLedgerMemberId(null)}
        heightRatio={0.7}>
        <Text style={[typography.title3, { color: c.text, marginBottom: 8 }]}>XP history</Text>
        <PersistentScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
          <XpLedgerView entries={ledgerEntries} fullXpByOccurrence={fullXpByOccurrence} />
        </PersistentScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space.sm },
  stack: { gap: space.md },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.card,
    padding: 4,
    gap: 4,
    marginBottom: space.md,
  },
  segmentChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  pendingBlock: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 10,
  },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  pendingActions: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vaultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vaultCell: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '48.5%',
  },
  createDashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.cardLarge,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 4,
  },
  allowanceSummaryCard: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 12,
  },
  allowanceSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  allowanceCard: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 12,
  },
  allowanceHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  allowanceActions: { flexDirection: 'row', gap: 8 },
  allowBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
  },
  askBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rankCatRow: { gap: 8, paddingVertical: 2 },
  rankCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  podiumCard: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    overflow: 'hidden',
    minHeight: 220,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 8,
  },
  podiumItem: { alignItems: 'center', gap: 6, minWidth: 72 },
  podiumBar: {
    width: '100%',
    minWidth: 72,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  rankBadge: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  levelPill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  miniTrack: { height: 4, borderRadius: 999, overflow: 'hidden', width: '85%' },
  miniFill: { height: '100%', borderRadius: 999 },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 90,
  },
  achievementsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  gamesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

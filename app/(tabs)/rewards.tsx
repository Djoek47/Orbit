import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Avatar } from '@/components/orbit/avatar';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RewardVaultCard } from '@/components/orbit/reward-vault-card';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  isAvatarImageUri,
  memberDisplayEmoji,
} from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember, HouseholdTask } from '@/types/orbit';

type Surface = 'rewards' | 'allowance' | 'ranks';
type RankCat = 'xp' | 'tasks' | 'streak' | 'improved';
type RankingView = 'week' | 'alltime';

const RANK_EMOJI = ['👑', '🥈', '🥉'] as const;

const RANK_CATS: { id: RankCat; label: string; emoji: string }[] = [
  { id: 'xp', label: 'Most XP', emoji: '⚡' },
  { id: 'tasks', label: 'Most Tasks', emoji: '✅' },
  { id: 'streak', label: 'Longest Streak', emoji: '🔥' },
  { id: 'improved', label: 'Most Improved', emoji: '📈' },
];

function resolveSurface(raw?: string | string[]): Surface {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'allowance') return 'allowance';
  if (value === 'ranks' || value === 'rankings') return 'ranks';
  if (value === 'rewards' || value === 'shop') return 'rewards';
  return 'rewards';
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
  } = useOrbit();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const caps = resolveMemberCapabilities(household);
  const isAdmin = permissions.canManageHousehold;
  const canRedeem = isAdmin || caps.allowRewardRedeem;
  const canRequestSpecial = isAdmin || caps.allowSpecialRewardRequest;
  const canApprove = isAdmin || permissions.canApproveReward;
  const showAllowance = caps.allowAllowance;

  const [surface, setSurface] = useState<Surface>(() => {
    const resolved = resolveSurface(params.surface);
    if (resolved === 'allowance' && !showAllowance) return 'rewards';
    return resolved;
  });
  const [rankCat, setRankCat] = useState<RankCat>('xp');
  const [view, setView] = useState<RankingView>('week');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [allowanceBusy, setAllowanceBusy] = useState(false);

  useEffect(() => {
    if (params.surface === undefined) return;
    const next = resolveSurface(params.surface);
    if (next === 'allowance' && !showAllowance) {
      setSurface('rewards');
      return;
    }
    setSurface(next);
  }, [params.surface, showAllowance]);

  useEffect(() => {
    if (surface === 'allowance' && !showAllowance) {
      setSurface('rewards');
    }
  }, [showAllowance, surface]);

  const selectSurface = (next: Surface) => {
    if (next === 'allowance' && !showAllowance) return;
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
      const pending = pendingAllowances.filter(
        (g) => g.memberId === member.id && g.status === 'pending'
      );
      const approved = pendingAllowances.filter(
        (g) => g.memberId === member.id && g.status === 'approved'
      );
      return {
        member,
        pendingCount: pending.length,
        approvedCount: approved.length,
        latestPending: pending[0],
      };
    });
  }, [pendingAllowances, vaultMembers]);

  const surfaceTabs = (
    [
      { id: 'rewards' as const, label: 'Rewards', show: true },
      { id: 'allowance' as const, label: 'Allowance', show: showAllowance },
      { id: 'ranks' as const, label: 'Rankings', show: true },
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
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}>
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
                Create Custom Reward
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.secondaryLinks}>
            {isAdmin ? (
              <Pressable onPress={() => router.push('/reward-tally' as never)}>
                <Text style={[typography.footnote, { color: accentTheme.primary }]}>
                  Full tally →
                </Text>
              </Pressable>
            ) : null}
            {canRequestSpecial ? (
              <Pressable onPress={() => router.push('/special-reward-request' as never)}>
                <Text style={[typography.footnote, { color: accentTheme.primary }]}>
                  Special request →
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
                  styles.payrollCard,
                  {
                    backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.1)',
                    borderColor: 'rgba(245,158,11,0.28)',
                  },
                ]}>
                <View style={styles.pendingHead}>
                  <MaterialIcons name="payments" size={16} color="#F59E0B" />
                  <Text style={[typography.headline, { color: '#F59E0B' }]}>
                    This Week&apos;s Allowance
                  </Text>
                </View>
                <View style={styles.payrollRow}>
                  <View>
                    <Text style={[typography.title2, { color: c.text }]}>
                      {pendingAllowances.length}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textSubtle }]}>Unpaid</Text>
                  </View>
                  <View>
                    <Text style={[typography.title2, { color: '#34D399' }]}>
                      {pendingAllowances.filter((g) => g.status === 'approved').length}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textSubtle }]}>Approved</Text>
                  </View>
                  <View>
                    <Text style={[typography.title2, { color: '#FB923C' }]}>
                      {pendingAllowances.filter((g) => g.status === 'pending').length}
                    </Text>
                    <Text style={[typography.caption1, { color: c.textSubtle }]}>Pending</Text>
                  </View>
                </View>
              </View>

              {allowanceRows.map(({ member, pendingCount, latestPending }, i) => (
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
                        {member.streak ?? 0}-day streak · {pendingCount} pending
                      </Text>
                    </View>
                    <Text style={[typography.title3, { color: '#34D399' }]}>
                      {latestPending?.amountLabel ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.allowanceActions}>
                    <Pressable
                      onPress={() => router.push('/grant-allowance' as never)}
                      style={[styles.allowBtn, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
                      <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 12 }}>
                        + Bonus
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/grant-allowance' as never)}
                      style={[styles.allowBtn, { backgroundColor: `${accentTheme.primary}22` }]}>
                      <Text style={{ color: accentTheme.primary, fontWeight: '700', fontSize: 12 }}>
                        Send Allowance
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push('/reward-tally' as never)}
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
                          onPress={() => void approveAllowance(grant.id)}
                          style={[styles.approveBtn, { backgroundColor: 'rgba(52,211,153,0.2)' }]}>
                          <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 12 }}>
                            Approve
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
                Ask an admin for cash or privilege allowances. They approve from the Allowance tab.
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
                  {allowanceBusy ? 'Sending…' : 'Ask for allowance'}
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
                  <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
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
                      {option === 'week' ? 'This Week' : 'All Time'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

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
                  <Text style={[styles.rankBadge, { color: c.textSubtle }]}>
                    {index < 3 ? RANK_EMOJI[index] : `#${index + 1}`}
                  </Text>
                  <Avatar
                    name={member.name}
                    emoji={member.avatarEmoji}
                    imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                    size="s"
                  />
                  <View style={{ flex: 1, gap: 4 }}>
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
                          {member.levelEmoji} {member.levelName}
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
                      <Text style={{ fontSize: 20 }}>{b.emoji}</Text>
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
                      <Text style={{ fontSize: 20 }}>{b.emoji}</Text>
                    </View>
                  ))}
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>
      ) : null}
    </ScrollView>
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
  payrollCard: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 12,
  },
  payrollRow: { flexDirection: 'row', justifyContent: 'space-between' },
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

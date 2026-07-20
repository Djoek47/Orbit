import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { MemberProgress } from '@/types/orbit';

type RewardsTab = 'rewards' | 'allowance' | 'rankings';
type RankCat = 'xp' | 'tasks' | 'streak';

const PODIUM_ORDER: [number, number, number] = [1, 0, 2];
const PODIUM_HEIGHTS = [100, 130, 85];
const RANK_EMOJI = ['👑', '🥈', '🥉'] as const;

/** Mock allowance rows until payroll ships to supabase. */
const ALLOWANCE_MOCK = [
  { name: 'Maya', emoji: '🌟', color: '#34D399', weekly: 10, earned: 7.5, pending: 2.5, streak: 5 },
  { name: 'Emma', emoji: '🦋', color: '#FB923C', weekly: 5, earned: 3, pending: 2, streak: 3 },
];

export default function RewardsScreen() {
  const {
    achievements,
    approveRedemption,
    currentMember,
    household,
    membersWithProgress,
    pendingRedemptions,
    permissions,
    rejectRedemption,
    requestRewardRedemption,
  } = useOrbit();

  const isParent = permissions.canApproveReward;
  const [activeTab, setActiveTab] = useState<RewardsTab>(isParent ? 'allowance' : 'rewards');
  const [rankCat, setRankCat] = useState<RankCat>('xp');

  const myProgress = useMemo(() => {
    if (!currentMember) return null;
    return membersWithProgress.find((member) => member.id === currentMember.id) ?? null;
  }, [currentMember, membersWithProgress]);

  const sorted = useMemo(() => {
    const active = membersWithProgress.filter(
      (member) => member.status === 'active' && member.role !== 'guest',
    );
    return [...active].sort((a, b) => {
      if (rankCat === 'tasks') return (b.tasksCompleted ?? 0) - (a.tasksCompleted ?? 0);
      if (rankCat === 'streak') return (b.streak ?? 0) - (a.streak ?? 0);
      return b.xp - a.xp;
    });
  }, [membersWithProgress, rankCat]);

  const top3 = sorted.slice(0, 3);
  const earnedCount = achievements.filter((badge) => badge.earned).length;
  const tabs = (
    [
      { id: 'rewards' as const, label: 'Rewards', show: true },
      { id: 'allowance' as const, label: 'Allowance', show: isParent },
      { id: 'rankings' as const, label: 'Rankings', show: true },
    ] as const
  ).filter((tab) => tab.show);

  const budgeted = ALLOWANCE_MOCK.reduce((sum, row) => sum + row.weekly, 0);
  const earned = ALLOWANCE_MOCK.reduce((sum, row) => sum + row.earned, 0);
  const pending = ALLOWANCE_MOCK.reduce((sum, row) => sum + row.pending, 0);

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Rewards & Rankings</Text>
        <Text style={orbitTypography.display}>
          {currentMember?.role === 'child' ? 'My Rewards' : 'Rewards Center'}
        </Text>
      </View>

      {currentMember?.role === 'child' && myProgress ? (
        <GlassCard elevated style={styles.xpCard}>
          <View style={orbitScreen.row}>
            <View>
              <Text style={[styles.levelName, { color: myProgress.levelColor }]}>
                {myProgress.levelEmoji} {myProgress.levelName}
              </Text>
              <Text style={orbitTypography.caption}>{myProgress.xp} XP total</Text>
            </View>
            <View style={styles.weekXpBlock}>
              <Text style={styles.weekXpValue}>{myProgress.weekXp}</Text>
              <Text style={orbitTypography.caption}>XP this week</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${myProgress.levelProgress * 100}%`,
                  backgroundColor: myProgress.levelColor,
                },
              ]}
            />
          </View>
        </GlassCard>
      ) : null}

      <View style={styles.toggleRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}>
              <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'rewards' ? (
        <>
          {pendingRedemptions.length > 0 ? (
            <GlassCard style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>🔔 Pending Approvals</Text>
              {pendingRedemptions.map((redemption) => {
                const reward = household.rewards.find((item) => item.id === redemption.rewardId);
                const member = household.members.find((item) => item.id === redemption.memberId);
                return (
                  <View key={redemption.id} style={styles.pendingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {member?.name ?? 'Member'} wants {reward?.title ?? 'a reward'}
                      </Text>
                      <Text style={orbitTypography.caption}>
                        {reward?.cost ?? 0} XP · {new Date(redemption.requestedAt).toLocaleString()}
                      </Text>
                    </View>
                    {permissions.canApproveReward ? (
                      <View style={styles.pendingActions}>
                        <Pressable
                          onPress={() => approveRedemption(redemption.id)}
                          style={styles.approveChip}>
                          <Text style={styles.approveText}>Approve</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => rejectRedemption(redemption.id)}
                          style={styles.denyChip}>
                          <Text style={styles.denyText}>Deny</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </GlassCard>
          ) : null}

          <View style={styles.rewardGrid}>
            {household.rewards.map((reward) => {
              const color = reward.color ?? orbitColors.primary;
              const canAfford = (myProgress?.xp ?? 0) >= reward.cost;
              return (
                <GlassCard key={reward.id} style={[styles.rewardTile, { borderColor: `${color}44` }]}>
                  <Text style={styles.rewardEmoji}>{reward.emoji ?? '🎁'}</Text>
                  <Text style={styles.rewardTitle}>{reward.title}</Text>
                  <Text style={orbitTypography.caption}>{reward.category ?? 'Reward'}</Text>
                  <View style={styles.rewardFooter}>
                    <Text style={[styles.rewardCost, { color }]}>⚡ {reward.cost}</Text>
                    <Pressable
                      onPress={() => requestRewardRedemption(reward.id)}
                      style={[
                        styles.redeemChip,
                        {
                          backgroundColor:
                            currentMember?.role === 'child'
                              ? canAfford
                                ? `${color}25`
                                : 'rgba(255,255,255,0.06)'
                              : `${color}25`,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.redeemText,
                          {
                            color:
                              currentMember?.role === 'child'
                                ? canAfford
                                  ? color
                                  : orbitColors.textSubtle
                                : color,
                          },
                        ]}>
                        {currentMember?.role === 'child' ? (canAfford ? 'Redeem' : 'Not yet') : 'Active'}
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </>
      ) : null}

      {activeTab === 'allowance' ? (
        <>
          <GlassCard style={styles.payrollCard}>
            <Text style={styles.payrollTitle}>💵 This Week&apos;s Payroll</Text>
            <View style={styles.payrollRow}>
              <View>
                <Text style={styles.payrollValue}>${budgeted.toFixed(2)}</Text>
                <Text style={orbitTypography.caption}>Budgeted</Text>
              </View>
              <View>
                <Text style={[styles.payrollValue, { color: orbitColors.success }]}>
                  ${earned.toFixed(2)}
                </Text>
                <Text style={orbitTypography.caption}>Earned</Text>
              </View>
              <View>
                <Text style={[styles.payrollValue, { color: '#FB923C' }]}>${pending.toFixed(2)}</Text>
                <Text style={orbitTypography.caption}>Pending</Text>
              </View>
            </View>
          </GlassCard>

          {ALLOWANCE_MOCK.map((child) => (
            <GlassCard key={child.name} style={styles.allowanceCard}>
              <View style={styles.allowanceHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: `${child.color}33` }]}>
                  <Text style={styles.avatarEmoji}>{child.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{child.name}</Text>
                  <Text style={orbitTypography.caption}>
                    ${child.weekly}/week · {child.streak}-day streak
                  </Text>
                </View>
                <View>
                  <Text style={[styles.payrollValue, { color: orbitColors.success, fontSize: 18 }]}>
                    ${child.earned.toFixed(2)}
                  </Text>
                  <Text style={orbitTypography.caption}>earned</Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(child.earned / child.weekly) * 100}%`,
                      backgroundColor: child.color,
                    },
                  ]}
                />
              </View>
              <View style={styles.allowanceActions}>
                <Pressable style={styles.bonusChip}>
                  <Text style={styles.bonusText}>+ Bonus</Text>
                </Pressable>
                <Pressable style={styles.payChip}>
                  <Text style={styles.payText}>Pay Now</Text>
                </Pressable>
                <Pressable style={styles.historyChip}>
                  <Text style={styles.historyText}>History</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}

          <GlassCard>
            <View style={orbitScreen.row}>
              <View>
                <Text style={orbitTypography.cardTitle}>Pay Schedule</Text>
                <Text style={orbitTypography.caption}>Every Sunday · Auto-approve</Text>
              </View>
              <Text style={styles.editLink}>Edit</Text>
            </View>
          </GlassCard>
        </>
      ) : null}

      {activeTab === 'rankings' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rankCats}>
            {(
              [
                { id: 'xp' as const, label: 'Most XP', emoji: '⚡' },
                { id: 'tasks' as const, label: 'Most Tasks', emoji: '✅' },
                { id: 'streak' as const, label: 'Longest Streak', emoji: '🔥' },
              ] as const
            ).map((cat) => {
              const active = rankCat === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setRankCat(cat.id)}
                  style={[styles.rankCatChip, active && styles.rankCatChipActive]}>
                  <Text style={[styles.rankCatLabel, active && styles.rankCatLabelActive]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <GlassCard elevated style={styles.podiumCard}>
            <View style={styles.podiumRow}>
              {PODIUM_ORDER.map((rankIndex, visualIndex) => {
                const member = top3[rankIndex];
                if (!member) return <View key={`empty-${visualIndex}`} style={styles.podiumSlot} />;
                const value = rankValue(member, rankCat);
                return (
                  <PodiumCard
                    key={member.id}
                    member={member}
                    rank={rankIndex}
                    value={value}
                    height={PODIUM_HEIGHTS[visualIndex]}
                    isFirst={rankIndex === 0}
                    suffix={rankCat === 'xp' ? ' XP' : rankCat === 'tasks' ? '✓' : '🔥'}
                  />
                );
              })}
            </View>
          </GlassCard>

          <GlassCard style={styles.listCard}>
            {sorted.map((member, index) => {
              const value = rankValue(member, rankCat);
              const isFirst = index === 0;
              return (
                <View
                  key={member.id}
                  style={[
                    styles.rankRow,
                    index < sorted.length - 1 && styles.rankRowBorder,
                    isFirst && styles.rankRowFirst,
                  ]}>
                  <View style={styles.rankBadge}>
                    {index < 3 ? (
                      <Text style={styles.rankEmoji}>{RANK_EMOJI[index]}</Text>
                    ) : (
                      <Text style={styles.rankNumber}>#{index + 1}</Text>
                    )}
                  </View>
                  <View style={[styles.avatarCircle, { backgroundColor: `${member.accentColor}33` }]}>
                    <Text style={styles.avatarEmoji}>{member.avatarEmoji}</Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <View style={[styles.levelPill, { backgroundColor: `${member.levelColor}22` }]}>
                        <Text style={[styles.levelPillText, { color: member.levelColor }]}>
                          {member.levelEmoji} {member.levelName}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.xpColumn}>
                    <Text style={[styles.xpValue, { color: isFirst ? '#FBBF24' : orbitColors.primary }]}>
                      {value}
                    </Text>
                    <Text style={styles.xpPeriod}>
                      {rankCat === 'xp' ? 'XP' : rankCat === 'tasks' ? 'tasks' : 'days'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>

          <Pressable onPress={() => router.push('/badge-gallery' as never)}>
            <GlassCard>
              <View style={orbitScreen.row}>
                <Text style={orbitTypography.cardTitle}>✨ Achievements</Text>
                <Text style={styles.earnedCount}>
                  {earnedCount}/{achievements.length}
                </Text>
              </View>
              <View style={styles.badgeGrid}>
                {achievements.slice(0, 8).map((badge) => (
                  <View key={badge.id} style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function rankValue(member: MemberProgress, cat: RankCat) {
  if (cat === 'tasks') return member.tasksCompleted ?? 0;
  if (cat === 'streak') return member.streak ?? 0;
  return member.xp;
}

function PodiumCard({
  member,
  rank,
  value,
  height,
  isFirst,
  suffix,
}: {
  member: MemberProgress;
  rank: number;
  value: number;
  height: number;
  isFirst: boolean;
  suffix: string;
}) {
  return (
    <View style={styles.podiumSlot}>
      {isFirst ? <Text style={styles.crown}>👑</Text> : <View style={styles.crownSpacer} />}
      <View
        style={[
          styles.podiumAvatar,
          isFirst && styles.podiumAvatarFirst,
          { backgroundColor: `${member.accentColor}44` },
        ]}>
        <Text style={[styles.podiumEmoji, isFirst && styles.podiumEmojiFirst]}>{member.avatarEmoji}</Text>
      </View>
      <Text style={styles.podiumName}>{member.name}</Text>
      <View
        style={[
          styles.podiumBlock,
          {
            height,
            borderColor: `${member.accentColor}55`,
            backgroundColor: `${member.accentColor}22`,
          },
        ]}>
        <Text style={[styles.podiumXp, { color: member.accentColor }]}>
          {value}
          {suffix}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  allowanceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  allowanceCard: {
    gap: orbitSpacing.md,
  },
  allowanceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  approveChip: {
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  approveText: {
    color: orbitColors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  avatarCircle: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  badgeEmoji: {
    fontSize: 20,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  badgeLocked: {
    opacity: 0.35,
  },
  bonusChip: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  bonusText: {
    color: orbitColors.success,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  crown: {
    fontSize: 18,
    lineHeight: 22,
  },
  crownSpacer: {
    height: 22,
  },
  denyChip: {
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  denyText: {
    color: orbitColors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  earnedCount: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  editLink: {
    color: orbitColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  historyChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  historyText: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  levelName: {
    fontSize: 18,
    fontWeight: '800',
  },
  levelPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  listCard: {
    gap: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  memberName: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  payChip: {
    backgroundColor: 'rgba(59,181,240,0.12)',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  payText: {
    color: orbitColors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  payrollCard: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.2)',
    gap: orbitSpacing.md,
  },
  payrollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  payrollTitle: {
    color: orbitColors.rewardsGold,
    fontSize: 14,
    fontWeight: '700',
  },
  payrollValue: {
    color: orbitColors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingCard: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.2)',
    gap: orbitSpacing.sm,
  },
  pendingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  pendingTitle: {
    color: orbitColors.rewardsGold,
    fontSize: 14,
    fontWeight: '700',
  },
  podiumAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  podiumAvatarFirst: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  podiumBlock: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    justifyContent: 'flex-end',
    minWidth: 72,
    paddingBottom: 10,
    width: '100%',
  },
  podiumCard: {
    overflow: 'hidden',
  },
  podiumEmoji: {
    fontSize: 22,
  },
  podiumEmojiFirst: {
    fontSize: 26,
  },
  podiumName: {
    color: orbitColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  podiumRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  podiumSlot: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  podiumXp: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressFill: {
    borderRadius: 999,
    height: 8,
  },
  progressTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  rankBadge: {
    alignItems: 'center',
    width: 28,
  },
  rankCatChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rankCatChipActive: {
    backgroundColor: 'rgba(59,181,240,0.2)',
    borderColor: 'rgba(59,181,240,0.35)',
  },
  rankCatLabel: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  rankCatLabelActive: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  rankCats: {
    gap: 8,
  },
  rankEmoji: {
    fontSize: 18,
  },
  rankInfo: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  rankNumber: {
    color: orbitColors.textSubtle,
    fontSize: 13,
    fontWeight: '700',
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: orbitSpacing.lg,
    paddingVertical: 14,
  },
  rankRowBorder: {
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
  },
  rankRowFirst: {
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  redeemChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  redeemText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rewardCost: {
    fontSize: 15,
    fontWeight: '800',
  },
  rewardEmoji: {
    fontSize: 28,
  },
  rewardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rewardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rewardTile: {
    borderWidth: 1,
    gap: 4,
    width: '48%',
  },
  rewardTitle: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(59, 181, 240, 0.2)',
    borderColor: 'rgba(59, 181, 240, 0.3)',
    borderWidth: 1,
  },
  toggleLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  toggleRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  weekXpBlock: {
    alignItems: 'flex-end',
  },
  weekXpValue: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  xpCard: {
    gap: orbitSpacing.md,
  },
  xpColumn: {
    alignItems: 'flex-end',
  },
  xpPeriod: {
    color: orbitColors.textSubtle,
    fontSize: 11,
  },
  xpValue: {
    fontSize: 16,
    fontWeight: '800',
  },
});

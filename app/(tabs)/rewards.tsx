import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { MemberProgress } from '@/types/orbit';

type RankingView = 'week' | 'alltime';

const PODIUM_ORDER: [number, number, number] = [1, 0, 2]; // visual: 2nd, 1st, 3rd
const PODIUM_HEIGHTS = [100, 130, 85];
const RANK_EMOJI = ['👑', '🥈', '🥉'] as const;

export default function RewardsScreen() {
  const {
    achievements,
    approveRedemption,
    household,
    membersWithProgress,
    pendingRedemptions,
    permissions,
    rejectRedemption,
    requestRewardRedemption,
  } = useOrbit();
  const [view, setView] = useState<RankingView>('week');

  const sorted = useMemo(() => {
    return [...membersWithProgress]
      .filter((member) => member.status === 'active' && member.role !== 'guest')
      .sort((a, b) => (view === 'week' ? b.weekXp - a.weekXp : b.xp - a.xp));
  }, [membersWithProgress, view]);

  const top3 = sorted.slice(0, 3);
  const earnedCount = achievements.filter((badge) => badge.earned).length;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Leaderboard</Text>
        <Text style={orbitTypography.display}>Family Rankings</Text>
        <Text style={orbitTypography.body}>
          Complete tasks to earn XP. Rankings update as household activity lands.
        </Text>
      </View>

      <View style={styles.toggleRow}>
        {(['week', 'alltime'] as const).map((option) => {
          const active = view === option;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}>
              <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
                {option === 'week' ? 'This Week' : 'All Time'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GlassCard elevated style={styles.podiumCard}>
        <View style={styles.podiumRow}>
          {PODIUM_ORDER.map((rankIndex, visualIndex) => {
            const member = top3[rankIndex];
            if (!member) {
              return <View key={`empty-${visualIndex}`} style={styles.podiumSlot} />;
            }
            const xpVal = view === 'week' ? member.weekXp : member.xp;
            const isFirst = rankIndex === 0;
            return (
              <PodiumCard
                key={member.id}
                member={member}
                rank={rankIndex}
                xp={xpVal}
                height={PODIUM_HEIGHTS[visualIndex]}
                isFirst={isFirst}
              />
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.listCard}>
        {sorted.map((member, index) => {
          const xpVal = view === 'week' ? member.weekXp : member.xp;
          const isFirst = index === 0;
          return (
            <View
              key={member.id}
              style={[styles.rankRow, index < sorted.length - 1 && styles.rankRowBorder, isFirst && styles.rankRowFirst]}>
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
                <View style={styles.xpBarRow}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${member.levelProgress * 100}%`,
                          backgroundColor: member.accentColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.xpCaption}>{member.xp} XP</Text>
                </View>
              </View>
              <View style={styles.xpColumn}>
                <Text style={[styles.xpValue, { color: isFirst ? '#FBBF24' : orbitColors.novaCyan }]}>
                  ⚡ {xpVal}
                </Text>
                <Text style={styles.xpPeriod}>{view === 'week' ? 'this week' : 'total'}</Text>
              </View>
            </View>
          );
        })}
      </GlassCard>

      <GlassCard>
        <Text style={orbitTypography.cardTitle}>🔥 Current Streaks</Text>
        <View style={styles.streakRow}>
          {sorted.map((member) => (
            <View key={`streak-${member.id}`} style={styles.streakItem}>
              <View style={[styles.avatarCircleSmall, { backgroundColor: `${member.accentColor}33` }]}>
                <Text style={styles.avatarEmojiSmall}>{member.avatarEmoji}</Text>
              </View>
              <Text
                style={[
                  styles.streakValue,
                  { color: (member.streak ?? 0) >= 7 ? '#FB923C' : orbitColors.text },
                ]}>
                {member.streak}
              </Text>
              <Text style={styles.streakCaption}>day streak</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <Pressable onPress={() => router.push('/badge-gallery' as never)}>
        <GlassCard>
          <View style={orbitScreen.row}>
            <Text style={orbitTypography.cardTitle}>🏆 Achievements</Text>
            <Text style={styles.earnedCount}>
              {earnedCount}/{achievements.length}
            </Text>
          </View>
          <View style={styles.badgeGrid}>
            {achievements.map((badge) => (
              <View key={badge.id} style={styles.badgeTile}>
                <View style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  {!badge.earned ? <Text style={styles.lockOverlay}>🔒</Text> : null}
                </View>
                <Text style={[styles.badgeLabel, !badge.earned && styles.badgeLabelMuted]}>{badge.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.collectionRow}>
            <Text style={orbitTypography.caption}>Collection progress</Text>
            <Text style={styles.collectionPct}>
              {achievements.length ? Math.round((earnedCount / achievements.length) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${achievements.length ? (earnedCount / achievements.length) * 100 : 0}%`,
                  backgroundColor: '#FBBF24',
                },
              ]}
            />
          </View>
        </GlassCard>
      </Pressable>

      <Text style={orbitTypography.title}>Reward shop</Text>
      {household.rewards.map((reward) => (
        <GlassCard key={reward.id} style={styles.rewardCard}>
          <View style={orbitScreen.row}>
            <View style={styles.rewardCopy}>
              <Text style={orbitTypography.cardTitle}>{reward.title}</Text>
              <Text style={orbitTypography.caption}>{reward.cost} XP</Text>
            </View>
            <Text style={styles.approvalLabel}>{reward.approvalRequired ? 'Approval' : 'Instant'}</Text>
          </View>
          <OrbitButton tone="secondary" onPress={() => requestRewardRedemption(reward.id)}>
            Redeem
          </OrbitButton>
        </GlassCard>
      ))}

      {pendingRedemptions.length > 0 ? (
        <>
          <Text style={orbitTypography.title}>Pending redemptions</Text>
          {pendingRedemptions.map((redemption) => {
            const reward = household.rewards.find((item) => item.id === redemption.rewardId);
            const member = household.members.find((item) => item.id === redemption.memberId);
            return (
              <GlassCard key={redemption.id} style={styles.rewardCard}>
                <Text style={orbitTypography.cardTitle}>{reward?.title ?? 'Reward'}</Text>
                <Text style={orbitTypography.caption}>
                  Requested by {member?.name ?? 'member'} · {new Date(redemption.requestedAt).toLocaleString()}
                </Text>
                {permissions.canApproveReward ? (
                  <View style={styles.redemptionActions}>
                    <OrbitButton style={styles.redemptionButton} onPress={() => approveRedemption(redemption.id)}>
                      Approve
                    </OrbitButton>
                    <OrbitButton
                      style={styles.redemptionButton}
                      tone="danger"
                      onPress={() => rejectRedemption(redemption.id)}>
                      Reject
                    </OrbitButton>
                  </View>
                ) : (
                  <Text style={orbitTypography.caption}>Waiting on household approval.</Text>
                )}
              </GlassCard>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

function PodiumCard({
  member,
  rank,
  xp,
  height,
  isFirst,
}: {
  member: MemberProgress;
  rank: number;
  xp: number;
  height: number;
  isFirst: boolean;
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
        <View style={[styles.podiumRankDot, { backgroundColor: rank === 0 ? '#FBBF24' : rank === 1 ? '#94A3B8' : '#FB923C' }]}>
          <Text style={styles.podiumRankText}>{rank + 1}</Text>
        </View>
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
        <Text style={[styles.podiumXp, { color: member.accentColor }]}>⚡ {xp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  approvalLabel: {
    color: orbitColors.warning,
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
  avatarCircleSmall: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  avatarEmojiSmall: {
    fontSize: 18,
  },
  badgeEmoji: {
    fontSize: 22,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.md,
  },
  badgeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  badgeLabel: {
    color: orbitColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelMuted: {
    color: orbitColors.textSubtle,
    fontWeight: '400',
  },
  badgeLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: orbitColors.border,
    opacity: 0.55,
  },
  badgeTile: {
    alignItems: 'center',
    gap: 6,
    width: '21%',
  },
  collectionPct: {
    color: orbitColors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  collectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  crown: {
    fontSize: 18,
    lineHeight: 22,
  },
  crownSpacer: {
    height: 22,
  },
  earnedCount: {
    color: orbitColors.success,
    fontSize: 13,
    fontWeight: '700',
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
  lockOverlay: {
    fontSize: 10,
    position: 'absolute',
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
  podiumAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    position: 'relative',
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
  podiumRankDot: {
    alignItems: 'center',
    borderRadius: 9,
    bottom: -2,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 18,
  },
  podiumRankText: {
    color: '#070D1C',
    fontSize: 10,
    fontWeight: '800',
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
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  rankBadge: {
    alignItems: 'center',
    width: 28,
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
  redemptionActions: {
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  redemptionButton: {
    flex: 1,
  },
  rewardCard: {
    gap: orbitSpacing.md,
  },
  rewardCopy: {
    flex: 1,
    gap: 4,
  },
  streakCaption: {
    color: orbitColors.textSubtle,
    fontSize: 9,
  },
  streakItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 8,
  },
  streakValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderColor: 'rgba(0, 194, 255, 0.35)',
    borderWidth: 1,
  },
  toggleLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: orbitColors.novaCyan,
    fontWeight: '700',
  },
  toggleRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  xpCaption: {
    color: orbitColors.textSubtle,
    fontSize: 11,
  },
  xpBarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';
import type { MemberProgress } from '@/types/orbit';

type RankingView = 'week' | 'alltime';

const PODIUM_ORDER: [number, number, number] = [1, 0, 2];
const PODIUM_HEIGHTS = [100, 130, 85];
const CROWN_COLORS = ['#FBBF24', '#94A3B8', '#FB923C'];
const RANK_EMOJI = ['👑', '🥈', '🥉'] as const;

export default function RewardsScreen() {
  const {
    accentTheme,
    achievements,
    approveRedemption,
    archiveReward,
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
  const collectionPct = achievements.length ? Math.round((earnedCount / achievements.length) * 100) : 0;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}>
      <View style={[orbitScreen.header, styles.header]}>
        <ChoremaxxBadge />
        <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Leaderboard</Text>
        <Text style={orbitTypography.display}>Family Rankings</Text>
      </View>

      <Pressable
        onPress={() => router.push('/household-games' as never)}
        style={[styles.gamesCard, { borderColor: `${accentTheme.primary}44` }]}>
        <Text style={styles.gamesEmoji}>🎮</Text>
        <View style={{ flex: 1 }}>
          <Text style={orbitTypography.cardTitle}>Household Games</Text>
          <Text style={orbitTypography.caption}>
            Drinking games, Uno, guessing nights — coming soon packs.
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={accentTheme.primary} />
      </Pressable>

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

      <LinearGradient
        colors={['rgba(14,165,233,0.12)', 'rgba(167,139,250,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.podiumCard}>
        <View style={styles.podiumAmbient} pointerEvents="none" />
        <View style={styles.podiumRow}>
          {PODIUM_ORDER.map((rankIndex, visualIndex) => {
            const member = top3[rankIndex];
            if (!member) {
              return <View key={`empty-${visualIndex}`} style={styles.podiumSlot} />;
            }
            const xpVal = view === 'week' ? member.weekXp : member.xp;
            return (
              <PodiumCard
                key={member.id}
                member={member}
                rank={rankIndex}
                xp={xpVal}
                height={PODIUM_HEIGHTS[visualIndex]}
                isFirst={rankIndex === 0}
              />
            );
          })}
        </View>
      </LinearGradient>

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
                  <View style={[styles.levelPill, { backgroundColor: `${member.levelColor}18` }]}>
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
                <Text style={[styles.xpValue, { color: isFirst ? orbitColors.rankGold : orbitColors.orbitBlue }]}>
                  ⚡ {xpVal}
                </Text>
                <Text style={styles.xpPeriod}>{view === 'week' ? 'this week' : 'total'}</Text>
              </View>
            </View>
          );
        })}
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeading}>
          <MaterialIcons name="local-fire-department" size={16} color={orbitColors.warning} />
          <Text style={orbitTypography.cardTitle}>Current Streaks</Text>
        </View>
        <View style={styles.streakRow}>
          {sorted.map((member) => (
            <View key={`streak-${member.id}`} style={styles.streakItem}>
              <View style={[styles.avatarCircleSmall, { backgroundColor: `${member.accentColor}33` }]}>
                <Text style={styles.avatarEmojiSmall}>{member.avatarEmoji}</Text>
              </View>
              <View style={styles.streakValueRow}>
                <MaterialIcons
                  name="local-fire-department"
                  size={10}
                  color={(member.streak ?? 0) >= 7 ? orbitColors.warning : orbitColors.textSubtle}
                />
                <Text
                  style={[
                    styles.streakValue,
                    { color: (member.streak ?? 0) >= 7 ? orbitColors.warning : orbitColors.textSoft },
                  ]}>
                  {member.streak}
                </Text>
              </View>
              <Text style={styles.streakCaption}>day streak</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <Pressable onPress={() => router.push('/badge-gallery' as never)}>
        <GlassCard>
          <View style={orbitScreen.row}>
            <View style={styles.sectionHeading}>
              <MaterialIcons name="emoji-events" size={16} color={orbitColors.rankGold} />
              <Text style={orbitTypography.cardTitle}>Achievements</Text>
            </View>
            <View style={styles.earnedRow}>
              <Text style={styles.earnedCount}>
                {earnedCount}/{achievements.length}
              </Text>
              <MaterialIcons name="chevron-right" size={12} color={orbitColors.textSubtle} />
            </View>
          </View>
          <View style={styles.badgeGrid}>
            {achievements.map((badge) => (
              <View key={badge.id} style={styles.badgeTile}>
                <View style={[styles.badgeIconWrap, !badge.earned && styles.badgeLocked]}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  {!badge.earned ? (
                    <View style={styles.lockOverlay}>
                      <MaterialIcons name="lock" size={12} color={orbitColors.textSubtle} />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.badgeLabel, !badge.earned && styles.badgeLabelMuted]}>{badge.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.collectionRow}>
            <Text style={styles.collectionCaption}>Collection progress</Text>
            <Text style={styles.collectionPct}>{collectionPct}%</Text>
          </View>
          <View style={styles.collectionTrack}>
            <LinearGradient
              colors={['#FBBF24', '#FB923C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.collectionFill, { width: `${collectionPct}%` }]}
            />
          </View>
        </GlassCard>
      </Pressable>

      <View style={styles.shopHeader}>
        <Text style={orbitTypography.display}>Reward shop</Text>
        <Text style={orbitTypography.caption}>Mint rewards or redeem with household XP</Text>
      </View>

      {permissions.canManageHousehold || permissions.canApproveReward ? (
        <OrbitButton onPress={() => router.push('/create-reward' as never)}>Mint reward</OrbitButton>
      ) : null}
      <OrbitButton tone="secondary" onPress={() => router.push('/special-reward-request' as never)}>
        Request special reward
      </OrbitButton>

      {household.rewards.map((reward) => (
        <GlassCard key={reward.id} style={styles.rewardCard}>
          <View style={orbitScreen.row}>
            <View style={styles.rewardCopy}>
              <Text style={orbitTypography.cardTitle}>
                {reward.emoji ? `${reward.emoji} ` : ''}
                {reward.title}
              </Text>
              <Text style={orbitTypography.caption}>
                {reward.cost} XP{reward.specialRequest ? ' · Special request' : ''}
              </Text>
            </View>
            <Text style={styles.approvalLabel}>{reward.approvalRequired ? 'Approval' : 'Instant'}</Text>
          </View>
          <OrbitButton tone="secondary" onPress={() => requestRewardRedemption(reward.id)}>
            Redeem
          </OrbitButton>
          {permissions.canManageHousehold ? (
            <OrbitButton tone="danger" onPress={() => archiveReward(reward.id)}>
              Archive
            </OrbitButton>
          ) : null}
        </GlassCard>
      ))}

      {pendingRedemptions.length > 0 ? (
        <>
          <Text style={orbitTypography.cardTitle}>Pending redemptions</Text>
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
      <View style={styles.podiumAvatarWrap}>
        <View
          style={[
            styles.podiumAvatar,
            isFirst && styles.podiumAvatarFirst,
            { backgroundColor: `${member.accentColor}44` },
          ]}>
          <Text style={[styles.podiumEmoji, isFirst && styles.podiumEmojiFirst]}>{member.avatarEmoji}</Text>
        </View>
        <View style={[styles.podiumRankDot, { backgroundColor: CROWN_COLORS[rank] }]}>
          <Text style={styles.podiumRankText}>{rank + 1}</Text>
        </View>
      </View>
      <Text style={styles.podiumName}>{member.name}</Text>
      <View
        style={[
          styles.podiumBlock,
          {
            height,
            borderColor: `${member.accentColor}33`,
            backgroundColor: `${member.accentColor}22`,
          },
        ]}>
        <Text style={[styles.podiumXp, { color: member.accentColor, fontSize: isFirst ? 15 : 13 }]}>⚡ {xp}</Text>
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
    gap: 12,
  },
  badgeIconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  badgeLabel: {
    color: orbitColors.textSoft,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelMuted: {
    color: orbitColors.textSubtle,
    fontWeight: '400',
  },
  badgeLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: orbitColors.border,
    opacity: 0.4,
  },
  badgeTile: {
    alignItems: 'center',
    gap: 6,
    width: '22%',
  },
  collectionCaption: {
    color: orbitColors.textMuted,
    fontSize: 12,
  },
  collectionFill: {
    borderRadius: 999,
    height: 6,
  },
  collectionPct: {
    color: orbitColors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  collectionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  collectionTrack: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    height: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  crown: {
    fontSize: 20,
    lineHeight: 24,
  },
  crownSpacer: {
    height: 24,
  },
  earnedCount: {
    color: orbitColors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  earnedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  header: {
    paddingTop: 4,
  },
  gamesCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  gamesEmoji: {
    fontSize: 28,
  },
  levelPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: orbitRadius.md,
    justifyContent: 'center',
  },
  memberName: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  podiumAmbient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,191,36,0.06)',
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
  podiumAvatarWrap: {
    position: 'relative',
  },
  podiumBlock: {
    alignItems: 'center',
    borderBottomWidth: 0,
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
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
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
    color: orbitColors.ink,
    fontSize: 9,
    fontWeight: '800',
  },
  podiumRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  podiumSlot: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  podiumXp: {
    fontWeight: '800',
  },
  progressFill: {
    borderRadius: 999,
    height: 4,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    flex: 1,
    height: 4,
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
    fontSize: 14,
    fontWeight: '700',
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: 14,
  },
  rankRowBorder: {
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
  },
  rankRowFirst: {
    backgroundColor: 'rgba(251,191,36,0.04)',
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
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  shopHeader: {
    gap: 4,
    marginTop: 8,
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
    gap: 12,
  },
  streakValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  streakValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  toggleButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: 'rgba(56,189,248,0.3)',
  },
  toggleLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '400',
  },
  toggleLabelActive: {
    color: orbitColors.orbitBlue,
    fontWeight: '600',
  },
  toggleRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: orbitRadius.md,
    flexDirection: 'row',
    padding: 4,
  },
  xpBarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  xpCaption: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  xpColumn: {
    alignItems: 'flex-end',
  },
  xpPeriod: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  xpValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { GlassCard } from '@/components/orbit/glass-card';
import { useTabChromePaddingTop } from '@/components/orbit/global-header-chips';
import { Leaderboard, type LeaderboardEntry } from '@/components/orbit/leaderboard';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { RewardClaimPress } from '@/components/orbit/reward-claim-press';
import { orbitColors, orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import {
  findSharedDeviceForMember,
  isSharedDeviceRole,
} from '@/lib/household/shared-device';
import { resolveMemberCapabilities } from '@/lib/member-capabilities';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

type RankingView = 'week' | 'alltime';
type Surface = 'ranks' | 'rewards';

const RANK_EMOJI = ['👑', '🥈', '🥉'] as const;

function resolveSurface(raw?: string | string[]): Surface {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'rewards' || value === 'shop' ? 'rewards' : 'ranks';
}

function SharedTabletChip({ device, compact }: { device: HouseholdMember; compact?: boolean }) {
  const { c, glass, glassBorder } = useOrbitColors();
  return (
    <View
      style={[
        styles.deviceChip,
        { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) },
        compact && styles.deviceChipCompact,
      ]}>
      <Text style={styles.deviceChipEmoji}>{device.avatar || '📱'}</Text>
      <Text
        style={[styles.deviceChipText, { color: c.textMuted }, compact && styles.deviceChipTextCompact]}
        numberOfLines={1}>
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
  const [surface, setSurface] = useState<Surface>(() => resolveSurface(params.surface));
  const [view, setView] = useState<RankingView>('week');
  const [shopCategory, setShopCategory] = useState<string>('All');
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [allowanceBusy, setAllowanceBusy] = useState(false);
  const caps = resolveMemberCapabilities(household);
  const isAdmin = permissions.canManageHousehold;
  const canRedeem = isAdmin || caps.allowRewardRedeem;
  const canRequestSpecial = isAdmin || caps.allowSpecialRewardRequest;
  const canApprove = isAdmin || permissions.canApproveReward;

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

  useEffect(() => {
    if (params.surface === undefined) return;
    setSurface(resolveSurface(params.surface));
  }, [params.surface]);

  const selectSurface = (next: Surface) => {
    setSurface(next);
    router.setParams({ surface: next } as never);
  };

  const sorted = useMemo(() => {
    return [...membersWithProgress]
      .filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          // Shared tablet shell is not a ranked person — Josh/Todd keep their own scores.
          !isSharedDeviceRole(member.role)
      )
      .sort((a, b) => (view === 'week' ? b.weekXp - a.weekXp : b.xp - a.xp));
  }, [membersWithProgress, view]);

  const deviceByMemberId = useMemo(() => {
    const map = new Map<string, HouseholdMember>();
    for (const member of sorted) {
      const device = findSharedDeviceForMember(member.id, household.members);
      if (device) map.set(member.id, device);
    }
    return map;
  }, [household.members, sorted]);

  const catalogRewards = useMemo(() => {
    return household.rewards.filter((reward) => {
      if (reward.archived) return false;
      // Non-admins only see open catalog + rewards assigned to them.
      if (
        !isAdmin &&
        reward.assignedMemberId &&
        reward.assignedMemberId !== currentMember?.id
      ) {
        return false;
      }
      if (memberFilter === 'all') return true;
      // Person chip: their assigned prizes + shared catalog.
      return !reward.assignedMemberId || reward.assignedMemberId === memberFilter;
    });
  }, [currentMember?.id, household.rewards, isAdmin, memberFilter]);

  const rewardCategories = useMemo(() => {
    const cats = Array.from(
      new Set(catalogRewards.map((reward) => reward.category?.trim() || 'Other'))
    ).sort((a, b) => a.localeCompare(b));
    return ['All', ...cats];
  }, [catalogRewards]);

  const groupedShopRewards = useMemo(() => {
    const filtered =
      shopCategory === 'All'
        ? catalogRewards
        : catalogRewards.filter((reward) => (reward.category?.trim() || 'Other') === shopCategory);
    const groups = new Map<string, typeof filtered>();
    for (const reward of filtered) {
      const key = reward.category?.trim() || 'Other';
      const list = groups.get(key) ?? [];
      list.push(reward);
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({ category, items }));
  }, [catalogRewards, shopCategory]);

  const top3 = sorted.slice(0, 3);
  const podiumEntries = useMemo<LeaderboardEntry[]>(
    () =>
      top3.map((member) => ({
        id: member.id,
        name: member.name,
        avatarEmoji: member.avatarEmoji,
        xp: view === 'week' ? member.weekXp : member.xp,
      })),
    [top3, view]
  );
  const earnedCount = achievements.filter((badge) => badge.earned).length;
  const collectionPct = achievements.length ? Math.round((earnedCount / achievements.length) * 100) : 0;

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: chromePad }]}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}>
      <View style={[orbitScreen.header, styles.header]}>
        <PageEyebrow>{surface === 'ranks' ? 'Leaderboard' : 'Shop'}</PageEyebrow>
        <Text style={[typography.title1, { color: orbitPalette.text }]}>
          {surface === 'ranks' ? 'Family Rankings' : 'Rewards'}
        </Text>
      </View>

      <View style={styles.surfaceRow}>
        {([
          { id: 'ranks' as const, label: 'Ranks', icon: 'emoji-events' as const },
          { id: 'rewards' as const, label: 'Rewards', icon: 'card-giftcard' as const },
        ]).map((tab) => {
          const active = surface === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => selectSurface(tab.id)}
              style={[
                styles.surfaceChip,
                {
                  backgroundColor: glass(0.04),
                  borderColor: glassBorder(0.1),
                },
                active && {
                  backgroundColor: `${accentTheme.primary}2E`,
                  borderColor: `${accentTheme.primary}66`,
                },
              ]}>
              <MaterialIcons
                name={tab.icon}
                size={16}
                color={active ? accentTheme.primary : c.textSubtle}
              />
              <Text
                style={[
                  styles.surfaceChipText,
                  { color: c.textSubtle },
                  active && { color: accentTheme.primary, fontWeight: '700' },
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {surface === 'ranks' ? (
        <>
      <Pressable
        onPress={() => router.push('/household-games' as never)}
        style={[
          styles.gamesCard,
          {
            borderColor: `${accentTheme.primary}44`,
            backgroundColor: glassFill(isDark),
          },
        ]}>
        <Text style={styles.gamesEmoji}>🎮</Text>
        <View style={{ flex: 1 }}>
          <Text style={[typography.headline, { color: orbitPalette.text }]}>Household Games</Text>
          <Text style={[typography.footnote, { color: orbitPalette.textSoft }]}>
            Drinking games, Uno, guessing nights — coming soon packs.
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={accentTheme.primary} />
      </Pressable>

      <View style={[styles.toggleRow, { backgroundColor: glass(0.06) }]}>
        {(['week', 'alltime'] as const).map((option) => {
          const active = view === option;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}>
              <Text
                style={[
                  styles.toggleLabel,
                  { color: c.textSubtle },
                  active && styles.toggleLabelActive,
                ]}>
                {option === 'week' ? 'This Week' : 'All Time'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.podiumCard,
          {
            backgroundColor: glassFill(isDark, 0.04),
            borderColor: orbitPalette.border,
          },
        ]}>
        <Leaderboard entries={podiumEntries} variant="podium" />
      </View>

      <GlassCard style={styles.listCard}>
        {sorted.map((member, index) => {
          const xpVal = view === 'week' ? member.weekXp : member.xp;
          const isFirst = index === 0;
          return (
            <View
              key={member.id}
              style={[
                styles.rankRow,
                index < sorted.length - 1 && {
                  borderBottomColor: glassBorder(0.05),
                  borderBottomWidth: 1,
                },
                isFirst && styles.rankRowFirst,
              ]}>
              <View style={styles.rankBadge}>
                {index < 3 ? (
                  <Text style={styles.rankEmoji}>{RANK_EMOJI[index]}</Text>
                ) : (
                  <Text style={[styles.rankNumber, { color: c.textSubtle }]}>#{index + 1}</Text>
                )}
              </View>
              <View style={[styles.avatarCircle, { backgroundColor: `${member.accentColor}33` }]}>
                <Text style={styles.avatarEmoji}>{member.avatarEmoji}</Text>
              </View>
              <View style={styles.rankInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.memberName, { color: orbitPalette.text }]}>{member.name}</Text>
                  {deviceByMemberId.get(member.id) ? (
                    <SharedTabletChip device={deviceByMemberId.get(member.id)!} />
                  ) : null}
                  <View style={[styles.levelPill, { backgroundColor: `${member.levelColor}18` }]}>
                    <Text style={[styles.levelPillText, { color: member.levelColor }]}>
                      {member.levelEmoji} {member.levelName}
                    </Text>
                  </View>
                </View>
                <View style={styles.xpBarRow}>
                  <View style={[styles.progressTrack, { backgroundColor: glass(0.08) }]}>
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
                  <Text style={[styles.xpCaption, { color: c.textSubtle }]}>{member.xp} XP</Text>
                </View>
              </View>
              <View style={styles.xpColumn}>
                <Text style={[styles.xpValue, { color: isFirst ? c.rankGold : c.orbitBlue }]}>
                  ⚡ {xpVal}
                </Text>
                <Text style={[styles.xpPeriod, { color: c.textSubtle }]}>
                  {view === 'week' ? 'this week' : 'total'}
                </Text>
              </View>
            </View>
          );
        })}
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeading}>
          <MaterialIcons name="local-fire-department" size={16} color={c.warning} />
          <Text style={[typography.headline, { color: orbitPalette.text }]}>Current Streaks</Text>
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
                  color={(member.streak ?? 0) >= 7 ? c.warning : c.textSubtle}
                />
                <Text
                  style={[
                    styles.streakValue,
                    { color: (member.streak ?? 0) >= 7 ? c.warning : c.textSoft },
                  ]}>
                  {member.streak}
                </Text>
              </View>
              <Text style={[styles.streakCaption, { color: c.textSubtle }]}>day streak</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <Pressable onPress={() => router.push('/badge-gallery' as never)}>
        <GlassCard>
          <View style={orbitScreen.row}>
            <View style={styles.sectionHeading}>
              <MaterialIcons name="emoji-events" size={16} color={c.rankGold} />
              <Text style={[typography.headline, { color: orbitPalette.text }]}>Achievements</Text>
            </View>
            <View style={styles.earnedRow}>
              <Text style={[styles.earnedCount, { color: c.success }]}>
                {earnedCount}/{achievements.length}
              </Text>
              <MaterialIcons name="chevron-right" size={12} color={c.textSubtle} />
            </View>
          </View>
          <View style={styles.badgeGrid}>
            {achievements.map((badge) => (
              <View key={badge.id} style={styles.badgeTile}>
                <View
                  style={[
                    styles.badgeIconWrap,
                    !badge.earned && {
                      backgroundColor: glass(0.04),
                      borderColor: orbitPalette.border,
                      opacity: 0.4,
                    },
                  ]}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  {!badge.earned ? (
                    <View style={styles.lockOverlay}>
                      <MaterialIcons name="lock" size={12} color={c.textSubtle} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.badgeLabel,
                    { color: badge.earned ? c.textSoft : c.textSubtle },
                    !badge.earned && styles.badgeLabelMuted,
                  ]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.collectionRow}>
            <Text style={[styles.collectionCaption, { color: c.textMuted }]}>Collection progress</Text>
            <Text style={[styles.collectionPct, { color: c.success }]}>{collectionPct}%</Text>
          </View>
          <View style={[styles.collectionTrack, { backgroundColor: glass(0.06) }]}>
            <LinearGradient
              colors={['#FBBF24', '#FB923C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.collectionFill, { width: `${collectionPct}%` }]}
            />
          </View>
        </GlassCard>
      </Pressable>
        </>
      ) : (
        <>
      <View style={[styles.shopHero, { borderColor: glassBorder(0.08) }]}>
        <LinearGradient
          colors={[`${accentTheme.primary}33`, 'rgba(251,191,36,0.12)', glass(0.03)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.shopHeroGlow}
        />
        <Text style={styles.shopKicker}>{isAdmin ? 'ADMIN SHOP' : 'YOUR SHOP'}</Text>
        <Text style={[styles.shopTitle, { color: orbitPalette.text }]}>
          {isAdmin ? 'Reward vault' : 'Claim your wins'}
        </Text>
        <Text style={[styles.shopSub, { color: orbitPalette.textMuted }]}>
          {isAdmin
            ? 'Mint or assign prizes, grant allowances, approve requests.'
            : `You have ${(currentMember?.xp ?? 0).toLocaleString()} XP · hold to claim or request`}
        </Text>
        {isAdmin ? (
          <View style={styles.manageRail}>
            <Pressable
              onPress={() => router.push('/create-reward' as never)}
              style={[styles.manageChip, { backgroundColor: accentTheme.primary }]}>
              <MaterialIcons name="auto-awesome" size={16} color="#04101F" />
              <Text style={styles.manageChipDark}>Mint</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/grant-allowance' as never)}
              style={[styles.manageChip, { borderColor: `${accentTheme.primary}55` }]}>
              <MaterialIcons name="payments" size={16} color={accentTheme.primary} />
              <Text style={[styles.manageChipLight, { color: accentTheme.primary }]}>Allowance</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/reward-tally' as never)}
              style={[styles.manageChip, { borderColor: `${accentTheme.primary}55` }]}>
              <MaterialIcons name="receipt-long" size={16} color={accentTheme.primary} />
              <Text style={[styles.manageChipLight, { color: accentTheme.primary }]}>Tally</Text>
            </Pressable>
            {canRequestSpecial ? (
              <Pressable
                onPress={() => router.push('/special-reward-request' as never)}
                style={[styles.manageChip, { borderColor: glassBorder(0.14) }]}>
                <MaterialIcons name="favorite-border" size={16} color={c.textSoft} />
                <Text style={[styles.manageChipLight, { color: c.textSoft }]}>Special</Text>
              </Pressable>
            ) : null}
            {/* Admin can also request for end-to-end testing. */}
            <Pressable
              disabled={allowanceBusy}
              onPress={() => {
                setAllowanceBusy(true);
                void requestAllowance({ amountLabel: '$5', note: 'Admin test allowance ask' })
                  .then((grant) => {
                    if (grant) {
                      Alert.alert('Allowance requested', 'Reviewers were notified to approve.');
                    }
                  })
                  .finally(() => setAllowanceBusy(false));
              }}
              style={[styles.manageChip, { borderColor: glassBorder(0.14) }]}>
              <MaterialIcons name="payments" size={16} color={c.textSoft} />
              <Text style={[styles.manageChipLight, { color: c.textSoft }]}>
                {allowanceBusy ? 'Sending…' : 'Ask'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.manageRail}>
            {canRequestSpecial ? (
              <Pressable
                onPress={() => router.push('/special-reward-request' as never)}
                style={[styles.manageChip, { borderColor: `${accentTheme.primary}55` }]}>
                <MaterialIcons name="favorite-border" size={16} color={accentTheme.primary} />
                <Text style={[styles.manageChipLight, { color: accentTheme.primary }]}>Special</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={allowanceBusy}
              onPress={() => {
                setAllowanceBusy(true);
                void requestAllowance({ amountLabel: '$5', note: 'Weekly allowance ask' })
                  .then((grant) => {
                    if (grant) {
                      Alert.alert('Allowance requested', 'An admin was notified to approve.');
                    }
                  })
                  .finally(() => setAllowanceBusy(false));
              }}
              style={[styles.manageChip, { borderColor: glassBorder(0.14) }]}>
              <MaterialIcons name="payments" size={16} color={c.textSoft} />
              <Text style={[styles.manageChipLight, { color: c.textSoft }]}>
                {allowanceBusy ? 'Sending…' : 'Ask allowance'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChipRow}>
        <Pressable
          onPress={() => setMemberFilter('all')}
          style={[
            styles.categoryChip,
            { borderColor: glassBorder(0.12) },
            memberFilter === 'all' && {
              backgroundColor: `${accentTheme.primary}2E`,
              borderColor: `${accentTheme.primary}66`,
            },
          ]}>
          <Text
            style={[
              styles.categoryChipText,
              { color: c.textMuted },
              memberFilter === 'all' && { color: accentTheme.primary },
            ]}>
            All people
          </Text>
        </Pressable>
        {vaultMembers.map((member) => {
          const active = memberFilter === member.id;
          const assignedCount = household.rewards.filter(
            (reward) => !reward.archived && reward.assignedMemberId === member.id
          ).length;
          return (
            <Pressable
              key={member.id}
              onPress={() => setMemberFilter(member.id)}
              style={[
                styles.categoryChip,
                { borderColor: glassBorder(0.12) },
                active && {
                  backgroundColor: `${accentTheme.primary}2E`,
                  borderColor: `${accentTheme.primary}66`,
                },
              ]}>
              <Text style={{ fontSize: 13 }}>{memberDisplayEmoji(member)}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  { color: c.textMuted },
                  active && { color: accentTheme.primary },
                ]}>
                {member.name}
                {assignedCount > 0 ? ` · ${assignedCount}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChipRow}>
        {rewardCategories.map((category) => {
          const active = shopCategory === category;
          return (
            <Pressable
              key={category}
              onPress={() => setShopCategory(category)}
              style={[
                styles.categoryChip,
                { borderColor: glassBorder(0.12) },
                active && {
                  backgroundColor: `${accentTheme.primary}2E`,
                  borderColor: `${accentTheme.primary}66`,
                },
              ]}>
              <Text
                style={[
                  styles.categoryChipText,
                  { color: c.textMuted },
                  active && { color: accentTheme.primary },
                ]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {groupedShopRewards.map((group, groupIndex) => (
        <View key={group.category} style={styles.shopSection}>
          <Text style={[styles.shopSectionTitle, { color: orbitPalette.textSoft }]}>
            {group.category}
          </Text>
          {group.items.map((reward, index) => {
            const origin =
              reward.origin ?? (reward.specialRequest ? 'special-request' : 'minted');
            const mode = reward.approvalRequired ? 'request' : 'instant';
            const canAfford = (currentMember?.xp ?? 0) >= reward.cost;
            return (
              <Animated.View
                key={reward.id}
                entering={FadeInDown.delay(40 + groupIndex * 30 + index * 40).springify()}
                exiting={FadeOut.duration(320)}
                layout={LinearTransition.duration(280)}>
                <LinearGradient
                  colors={[
                    `${reward.color ?? accentTheme.primary}18`,
                    glass(0.04),
                    glassFill(isDark, 0.03),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.vaultCard,
                    { borderColor: `${reward.color ?? accentTheme.primary}33` },
                  ]}>
                  <View style={styles.vaultTop}>
                    <View style={[styles.vaultEmojiWrap, { backgroundColor: glass(0.06) }]}>
                      <Text style={styles.vaultEmoji}>{reward.emoji || '🎁'}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.vaultTitle, { color: orbitPalette.text }]}>
                        {reward.title}
                      </Text>
                      {reward.assignedMemberName ? (
                        <Text style={[styles.shopSub, { color: orbitPalette.textMuted }]}>
                          For {reward.assignedMemberName}
                        </Text>
                      ) : null}
                      <View style={styles.vaultMetaRow}>
                        <View style={styles.xpStamp}>
                          <Text style={styles.xpStampText}>{reward.cost} XP</Text>
                        </View>
                        <Text style={[styles.vaultMode, { color: c.textMuted }]}>
                          {mode === 'instant' ? 'Instant' : 'Needs approval'}
                        </Text>
                        {isAdmin ? (
                          <Text style={[styles.vaultOrigin, { color: c.textSubtle }]}>
                            {origin === 'special-request' ? 'Request' : 'Minted'}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {canRedeem ? (
                      <RewardClaimPress
                        accent={accentTheme.primary}
                        mode={mode}
                        disabled={!canAfford}
                        busy={claimingId === reward.id}
                        onClaim={async () => {
                          if (!canAfford) {
                            Alert.alert('Not enough XP', `You need ${reward.cost} XP to claim this.`);
                            return;
                          }
                          setClaimingId(reward.id);
                          try {
                            const result = await claimReward(reward.id);
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
                        }}
                      />
                    ) : null}
                  </View>
                  {isAdmin ? (
                    <Pressable onPress={() => void archiveReward(reward.id)} style={styles.archiveLink}>
                      <Text style={styles.archiveLinkText}>Archive</Text>
                    </Pressable>
                  ) : null}
                </LinearGradient>
              </Animated.View>
            );
          })}
        </View>
      ))}

      {canApprove && pendingRedemptions.length > 0 ? (
        <View style={styles.pendingBlock}>
          <View style={styles.pendingHead}>
            <Text style={[styles.pendingTitle, { color: orbitPalette.text }]}>
              Pending claims · {pendingRedemptions.length}
            </Text>
            <Pressable onPress={() => router.push('/reward-tally' as never)}>
              <Text style={[styles.tallyLinkText, { color: accentTheme.primary }]}>Full tally</Text>
            </Pressable>
          </View>
          {pendingRedemptions.slice(0, 3).map((redemption) => {
            const reward = household.rewards.find((item) => item.id === redemption.rewardId);
            const member = household.members.find((item) => item.id === redemption.memberId);
            return (
              <View
                key={redemption.id}
                style={[
                  styles.pendingCard,
                  {
                    backgroundColor: glassFill(isDark),
                    borderColor: glassBorder(0.08),
                  },
                ]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.vaultTitle, { color: orbitPalette.text }]}>
                    {reward?.title ?? 'Reward'}
                  </Text>
                  <Text style={[styles.shopSub, { color: orbitPalette.textMuted }]}>
                    {member?.name ?? 'member'} · {new Date(redemption.requestedAt).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.redemptionActions}>
                  <OrbitButton
                    style={styles.redemptionButton}
                    onPress={() => void approveRedemption(redemption.id)}>
                    Approve
                  </OrbitButton>
                  <OrbitButton
                    style={styles.redemptionButton}
                    tone="danger"
                    onPress={() => void rejectRedemption(redemption.id)}>
                    Reject
                  </OrbitButton>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {canApprove && pendingAllowances.length > 0 ? (
        <View style={styles.pendingBlock}>
          <View style={styles.pendingHead}>
            <Text style={[styles.pendingTitle, { color: orbitPalette.text }]}>
              Pending allowances · {pendingAllowances.length}
            </Text>
          </View>
          {pendingAllowances.slice(0, 3).map((grant) => (
            <View
              key={grant.id}
              style={[
                styles.pendingCard,
                {
                  backgroundColor: glassFill(isDark),
                  borderColor: glassBorder(0.08),
                },
              ]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.vaultTitle, { color: orbitPalette.text }]}>{grant.amountLabel}</Text>
                <Text style={[styles.shopSub, { color: orbitPalette.textMuted }]}>
                  {grant.memberName}
                  {grant.note ? ` · ${grant.note}` : ''} ·{' '}
                  {new Date(grant.requestedAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.redemptionActions}>
                <OrbitButton
                  style={styles.redemptionButton}
                  onPress={() => void approveAllowance(grant.id)}>
                  Approve
                </OrbitButton>
                <OrbitButton
                  style={styles.redemptionButton}
                  tone="danger"
                  onPress={() => void rejectAllowance(grant.id)}>
                  Reject
                </OrbitButton>
              </View>
            </View>
          ))}
        </View>
      ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  approvalLabel: {
    color: orbitColors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  approvalPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  approvalPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shopActions: {
    gap: 10,
  },
  tallyLink: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tallyLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  shopSection: {
    gap: 10,
  },
  shopSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pendingHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    borderRadius: radius.control,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeLabelMuted: {
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
    paddingTop: 0,
  },
  surfaceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  surfaceChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  surfaceChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  gamesCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.card,
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
    borderRadius: radius.control,
    justifyContent: 'center',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  deviceChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deviceChipCompact: {
    marginBottom: 4,
    marginTop: 2,
    maxWidth: 110,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deviceChipEmoji: {
    fontSize: 11,
  },
  deviceChipText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  deviceChipTextCompact: {
    fontSize: 9,
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
    borderRadius: radius.card,
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
    fontSize: 14,
    fontWeight: '700',
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: space.md,
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
    gap: space.md,
  },
  redemptionButton: {
    flex: 1,
  },
  rewardCard: {
    gap: space.md,
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
    fontSize: 14,
    fontWeight: '400',
  },
  toggleLabelActive: {
    color: orbitColors.orbitBlue,
    fontWeight: '600',
  },
  toggleRow: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.control,
    flexDirection: 'row',
    padding: 4,
  },
  xpBarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  xpCaption: {
    fontSize: 12,
  },
  xpColumn: {
    alignItems: 'flex-end',
  },
  xpPeriod: {
    fontSize: 12,
  },
  xpValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  shopHero: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    padding: 18,
  },
  shopHeroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  shopKicker: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  shopTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  shopSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  manageRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  manageChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  manageChipDark: {
    color: '#04101F',
    fontSize: 13,
    fontWeight: '800',
  },
  manageChipLight: {
    fontSize: 13,
    fontWeight: '700',
  },
  memberSpecial: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberSpecialText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vaultCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  vaultTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  vaultEmojiWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  vaultEmoji: { fontSize: 28 },
  vaultTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  vaultMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  xpStamp: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  xpStampText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  vaultMode: {
    fontSize: 11,
    fontWeight: '600',
  },
  vaultOrigin: {
    fontSize: 11,
    fontWeight: '600',
  },
  archiveLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  archiveLinkText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingBlock: { gap: 10 },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pendingCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },

});

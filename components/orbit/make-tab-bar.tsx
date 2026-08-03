import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedTrophyTab } from '@/components/orbit/animated-trophy-tab';
import { MorphingTabLabel } from '@/components/orbit/morphing-tab-label';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitTabColors, radius, shadow, space } from '@/constants/orbit-theme';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { capabilitiesFor, DEFAULT_REWARD_MODEL } from '@/lib/rewards/reward-model';
import { glassBorder, glassFill } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

const TAB_ORDER = ['index', 'tasks', 'plan', 'rewards', 'poppins'] as const;
type TabRoute = (typeof TAB_ORDER)[number];

const TAB_META: Record<
  TabRoute,
  { label: string; color: string; icon: 'house.fill' | 'checklist' | 'calendar' | 'trophy.fill' | 'sparkles' }
> = {
  index: { label: 'Home', color: orbitTabColors.home, icon: 'house.fill' },
  tasks: { label: 'Tasks', color: orbitTabColors.tasks, icon: 'checklist' },
  plan: { label: 'Plan', color: orbitTabColors.plan, icon: 'calendar' },
  rewards: { label: 'Rewards', color: orbitTabColors.ranking, icon: 'trophy.fill' },
  poppins: { label: 'Poppins', color: orbitTabColors.poppins, icon: 'sparkles' },
};

/** Hold each word long enough for the morph (~720ms) to feel magical. */
const LABEL_CYCLE_MS = 3400;

/**
 * Floating Liquid Glass tab bar — Day uses colored light glass; Night keeps
 * deep accent wash. Rewards tab label morphs by role:
 * admin/parent → Rewards ↔ Ranks · child → Ranks ↔ Redeem.
 * Trophy + letters animate harder when the member can afford a redeem.
 */
export function MakeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const accentPrimary = orbit?.accentTheme.primary ?? '#38BDF8';
  const accentSecondary = orbit?.accentTheme.secondary ?? '#0EA5E9';
  const typeStyle = orbit?.accentTheme.typeStyle;
  const palette = orbit?.orbitPalette;
  const isDark = palette?.isDark ?? true;
  const inactive = palette?.tabInactive ?? '#3A5070';
  const ink = palette?.ink ?? '#070D1C';
  const activeRouteName = state.routes[state.index]?.name;

  const isChildMode = useMemo(() => {
    const member = orbit?.currentMember;
    const members = orbit?.household.members ?? [];
    if (!member) return false;
    return member.role === 'child' || isSharedDeviceAccount(member, members);
  }, [orbit?.currentMember, orbit?.household.members]);

  const modelCaps = useMemo(
    () => capabilitiesFor(orbit?.household.rewardModel ?? DEFAULT_REWARD_MODEL),
    [orbit?.household.rewardModel]
  );

  const canAffordRedeem = useMemo(() => {
    if (!modelCaps.rewardsEnabled) return false;
    const rewards = orbit?.household.rewards ?? [];
    // v2 §6.1: rewards are grants, not XP purchases — animate when any live reward exists.
    return rewards.some((reward) => !reward.archived);
  }, [modelCaps.rewardsEnabled, orbit?.household.rewards]);

  const rewardsCycle = useMemo(() => {
    const labels: Array<'Rewards' | 'Ranks' | 'Redeem' | 'Allowance'> = [];
    if (modelCaps.rewardsEnabled) {
      labels.push(isChildMode ? 'Redeem' : 'Rewards');
    }
    if (modelCaps.xpEnabled) labels.push('Ranks');
    if (modelCaps.allowanceEnabled && !modelCaps.rewardsEnabled && !modelCaps.xpEnabled) {
      labels.push('Allowance');
    }
    if (labels.length === 0) labels.push('Rewards');
    if (isChildMode && modelCaps.rewardsEnabled && canAffordRedeem && labels[0] !== 'Redeem') {
      return ['Redeem', ...labels.filter((l) => l !== 'Redeem')] as typeof labels;
    }
    return labels;
  }, [canAffordRedeem, isChildMode, modelCaps]);

  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    setCycleIndex(0);
    // Slightly snappier cycle when redeem XP is ready so Redeem shows more often.
    const period = canAffordRedeem ? LABEL_CYCLE_MS - 400 : LABEL_CYCLE_MS;
    const id = setInterval(() => {
      setCycleIndex((i) => (i + 1) % rewardsCycle.length);
    }, period);
    return () => clearInterval(id);
  }, [canAffordRedeem, rewardsCycle]);

  const rewardsLabel = rewardsCycle[cycleIndex] ?? rewardsCycle[0];

  const visibleRoutes = TAB_ORDER.map((name) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    const options = descriptors[route.key]?.options as { href?: string | null } | undefined;
    if (options?.href === null) return null;
    return { route };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const poppinsIdleColors = isDark
    ? (['#0F2644', '#0A1E38'] as const)
    : ([`${accentPrimary}33`, `${accentSecondary}28`] as const);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom - 4, space.xs) }]}>
      <View
        style={[
          styles.bar,
          isDark ? shadow.floating.dark : shadow.floating.light,
          {
            borderColor: glassBorder(isDark, isDark ? 0.12 : 0.14),
            backgroundColor: isDark ? 'transparent' : glassFill(false, 0.04),
          },
        ]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === 'ios' ? material.liquidGlass.intensity : material.liquidGlass.androidIntensity}
            tint={resolveBlurTint(isDark)}
            experimentalBlurMethod={androidBlurMethod}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={
              isDark
                ? [`${accentPrimary}33`, `${accentSecondary}1A`, 'transparent']
                : [`${accentPrimary}40`, `${accentSecondary}28`, 'rgba(255,255,255,0.55)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {!isDark ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(255,255,255,0.35)' },
              ]}
            />
          ) : null}
        </View>
        {visibleRoutes.map(({ route }) => {
          const isFocused = activeRouteName === route.name;
          const meta = TAB_META[route.name as TabRoute];
          if (!meta) return null;

          const isPoppins = route.name === 'poppins';
          const isRewards = route.name === 'rewards';
          const label = isRewards ? rewardsLabel : meta.label;
          const color = isFocused
            ? accentPrimary
            : isRewards && canAffordRedeem
              ? orbitTabColors.ranking
              : meta.color;
          const { icon } = meta;

          const onPress = () => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.selectionAsync();
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              if (isRewards && (rewardsLabel === 'Redeem' || rewardsLabel === 'Rewards')) {
                navigation.navigate(route.name, { surface: 'rewards' });
              } else if (isRewards && rewardsLabel === 'Ranks') {
                navigation.navigate(route.name, { surface: 'ranks' });
              } else if (isRewards && rewardsLabel === 'Allowance') {
                navigation.navigate(route.name, { surface: 'allowance' });
              } else {
                navigation.navigate(route.name, route.params);
              }
            } else if (isFocused && isRewards) {
              if (rewardsLabel === 'Redeem' || rewardsLabel === 'Rewards') {
                navigation.navigate(route.name, { surface: 'rewards' });
              } else if (rewardsLabel === 'Allowance') {
                navigation.navigate(route.name, { surface: 'allowance' });
              } else {
                navigation.navigate(route.name, { surface: 'ranks' });
              }
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const labelColor = isFocused
            ? isPoppins
              ? accentPrimary
              : color
            : isRewards && canAffordRedeem && rewardsLabel === 'Redeem'
              ? accentPrimary
              : inactive;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tab, isPoppins && styles.poppinsTab]}>
              {isPoppins ? (
                <LinearGradient
                  colors={isFocused ? [accentPrimary, accentSecondary] : [...poppinsIdleColors]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.poppinsButton,
                    isFocused ? styles.poppinsButtonActive : styles.poppinsButtonInactive,
                    {
                      borderColor: `${accentPrimary}66`,
                      shadowColor: accentPrimary,
                    },
                  ]}>
                  <IconSymbol
                    name={icon}
                    size={20}
                    color={isFocused ? ink : accentPrimary}
                  />
                </LinearGradient>
              ) : isRewards ? (
                <View style={styles.iconColumn}>
                  <View
                    style={[
                      styles.iconBox,
                      (isFocused || canAffordRedeem) && {
                        backgroundColor: `${color}${canAffordRedeem ? '28' : '1A'}`,
                      },
                    ]}>
                    <AnimatedTrophyTab
                      color={isFocused || canAffordRedeem ? color : inactive}
                      focused={isFocused}
                      morphKey={`${rewardsLabel}-${cycleIndex}`}
                      canRedeem={canAffordRedeem}
                      label={rewardsLabel}
                    />
                  </View>
                  {isFocused ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
                </View>
              ) : (
                <View style={styles.iconColumn}>
                  <View style={[styles.iconBox, isFocused && { backgroundColor: `${color}1A` }]}>
                    <IconSymbol name={icon} size={20} color={isFocused ? color : inactive} />
                  </View>
                  {isFocused ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
                </View>
              )}
              {isRewards ? (
                <View style={styles.rewardsLabelSlot}>
                  <MorphingTabLabel
                    text={label}
                    color={labelColor}
                    fontWeight={isFocused ? (typeStyle?.captionWeight ?? '600') : '400'}
                    letterSpacing={isFocused ? (typeStyle?.letterSpacing ?? 0) : 0}
                    energetic={canAffordRedeem || rewardsLabel === 'Redeem'}
                  />
                </View>
              ) : (
                <Text
                  style={[
                    styles.label,
                    {
                      color: labelColor,
                      fontWeight: isFocused ? (typeStyle?.captionWeight ?? '600') : '400',
                      letterSpacing: isFocused ? (typeStyle?.letterSpacing ?? 0) : 0,
                    },
                    isPoppins && styles.poppinsLabel,
                  ]}>
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: space.sm,
  },
  bar: {
    alignItems: 'flex-end',
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingBottom: 6,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingBottom: 4,
  },
  poppinsTab: {
    paddingBottom: 0,
  },
  iconColumn: {
    alignItems: 'center',
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dot: {
    borderRadius: 2,
    height: 4,
    marginTop: 2,
    width: 4,
  },
  poppinsButton: {
    alignItems: 'center',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    marginTop: -20,
    width: 48,
  },
  poppinsButtonActive: {
    elevation: 8,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  poppinsButtonInactive: {
    elevation: 4,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
  },
  rewardsLabelSlot: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 13,
    width: '100%',
  },
  poppinsLabel: {
    marginTop: 2,
    textAlign: 'center',
  },
});

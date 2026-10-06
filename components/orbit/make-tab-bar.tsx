import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedTrophyTab } from '@/components/orbit/animated-trophy-tab';
import { MorphingTabLabel } from '@/components/orbit/morphing-tab-label';
import { SwitchPeopleIcon } from '@/components/orbit/switch-people-icon';
import { useKeyboardVisible } from '@/lib/ui/use-keyboard-visible';
import { usePoppinsTypingMode } from '@/lib/ui/typing-mode';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitTabColors, radius, shadow, space } from '@/constants/orbit-theme';
import {
  findSharedDeviceForMember,
  isSharedDeviceAccount,
  isSharedDeviceRole,
  resolveSharedDevicePeople,
} from '@/lib/household/shared-device';
import { usePoppinsLive } from '@/lib/poppins/live-context';
import { capabilitiesFor, DEFAULT_REWARD_MODEL } from '@/lib/rewards/reward-model';
import { glassBorder, glassFill } from '@/lib/theme/use-orbit-colors';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';
import {
  isSharedTabletDeviceSession,
  markNeedsProfilePick,
  reconcileHostedDeviceSession,
  type DeviceSession,
} from '@/lib/device/device-session';
import { profilesForSharedDeviceSwitch } from '@/lib/device/profiles-for-switch';
import { useTabFifthSlot } from '@/lib/navigation/use-tab-fifth-slot';
import type { TourTargetId } from '@/lib/tour/tour-types';

const TAB_ORDER = ['index', 'tasks', 'plan', 'rewards', 'poppins'] as const;
type TabRoute = (typeof TAB_ORDER)[number];

const TAB_TOUR_TARGET: Partial<Record<TabRoute, TourTargetId>> = {
  tasks: 'tabbar.tasks',
  plan: 'tabbar.plan',
  rewards: 'tabbar.rewards',
  poppins: 'tabbar.poppins',
};

const TAB_META: Record<
  TabRoute,
  {
    label: string;
    color: string;
    icon:
      | 'house.fill'
      | 'checklist'
      | 'calendar'
      | 'trophy.fill'
      | 'sparkles'
      | 'arrow.left.arrow.right';
  }
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
  // While the keyboard is up the bar drops its labels and tightens: the keyboard needs those
  // ~26pt more than five words do, and the icons still say which tab is which.
  // Tight while the keyboard is up, and for the whole of Poppins' typing mode.
  const poppinsTyping = usePoppinsTypingMode();
  const keyboardUp = useKeyboardVisible() || poppinsTyping;
  const orbit = useOrbitOptional();
  const majordomoName = useMajordomoName();
  const poppinsLive = usePoppinsLive();
  const poppinsPulse = useRef(new Animated.Value(1)).current;
  // While a session is running, the tab button wears the household's chosen voice colour and
  // breathes, wherever you are in the app — so "Poppins is still listening" is visible from
  // Tasks or Plan, not only from its own tab.
  const [voiceColor, setVoiceColor] = useState<string | null>(null);
  const poppinsBusy = Boolean(poppinsLive && poppinsLive.visual !== 'idle');
  /**
   * The fifth slot is not the same button for everyone:
   *
   *   admin           Poppins
   *   shared tablet   Switch who's on — the thing people reach for on a shared iPad
   *   a Sidekick      nothing; four tabs, since they have no Poppins
   */
  const members = orbit?.household.members ?? [];
  const memberRole = orbit?.currentMember?.role;
  const fifthSlotRaw = useTabFifthSlot({
    role: memberRole,
    members,
    memberId: orbit?.currentMember?.id,
  });
  // Belt-and-suspenders: personal admin never sees the Switch tab.
  const fifthSlot =
    memberRole === 'owner' || memberRole === 'admin' ? 'poppins' : fifthSlotRaw;
  const [deviceSession, setDeviceSession] = useState<DeviceSession | null>(null);
  const rosterKey = members
    .filter((m) => m.role === 'shared-device')
    .map((m) => `${m.id}:${(m.sharedWithMemberIds ?? []).join(',')}`)
    .join('|');
  useEffect(() => {
    let mounted = true;
    void (async () => {
      // Personal admin: never reconcile into a Switch tablet binding.
      if (memberRole === 'owner' || memberRole === 'admin') {
        const { demoteSharedSessionForPersonalAdmin, loadDeviceSession } = await import(
          '@/lib/device/device-session'
        );
        const next = await demoteSharedSessionForPersonalAdmin(memberRole);
        if (mounted) setDeviceSession(next ?? (await loadDeviceSession()));
        return;
      }
      const next = await reconcileHostedDeviceSession(members);
      if (mounted) setDeviceSession(next);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbit?.currentMember?.id, fifthSlot, rosterKey, memberRole]);
  // How many faces share this tablet — drives the Switch glyph (2–6 arrows).
  const switchPeopleCount = useMemo(() => {
    const rosterPeople = profilesForSharedDeviceSwitch(deviceSession, members);
    if (rosterPeople.length >= 2) {
      return Math.min(6, rosterPeople.length);
    }
    if (
      deviceSession &&
      isSharedTabletDeviceSession(deviceSession) &&
      deviceSession.profileMemberIds.length > 0
    ) {
      return Math.min(6, Math.max(2, deviceSession.profileMemberIds.length));
    }
    const member = orbit?.currentMember;
    if (!member) return 2;
    const device = isSharedDeviceRole(member.role)
      ? member
      : findSharedDeviceForMember(member.id, members);
    const people = resolveSharedDevicePeople(device, members);
    return Math.min(6, Math.max(2, people.length || 2));
  }, [deviceSession, orbit?.currentMember, members]);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ loadPoppinsInteractionPrefs }, { poppinsVoice }] = await Promise.all([
          import('@/lib/poppins/poppins-prefs'),
          import('@/lib/ai/poppins-voices'),
        ]);
        const prefs = await loadPoppinsInteractionPrefs(orbit?.household.id);
        if (!cancelled) setVoiceColor(poppinsVoice(prefs.voiceId).color);
      } catch {
        /* the theme colour is a fine fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orbit?.household.id]);

  useEffect(() => {
    if (!poppinsBusy) {
      poppinsPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(poppinsPulse, { toValue: 1.12, duration: 420, useNativeDriver: true }),
        Animated.timing(poppinsPulse, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [poppinsBusy, poppinsPulse]);

  const visibleRoutes = TAB_ORDER.map((name) => {
    if (name === 'poppins' && fifthSlot !== 'poppins') return null;
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
      style={[
        styles.wrapper,
        { paddingBottom: keyboardUp ? 2 : Math.max(insets.bottom - 4, space.xs) },
      ]}>
      <View
        style={[
          styles.bar,
          keyboardUp && styles.barCompact,
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
          // Live: the voice's own colour. Idle: the theme, as before.
          const poppinsTone = poppinsBusy ? voiceColor ?? accentPrimary : accentPrimary;
          const isRewards = route.name === 'rewards';
          const label = isRewards ? rewardsLabel : isPoppins ? majordomoName : meta.label;
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
            if (isPoppins && poppinsLive && poppinsLive.visual !== 'idle' && isFocused) {
              void poppinsLive.stop();
              return;
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
            if (isPoppins) {
              void poppinsLive?.startInPlace('tab');
              return;
            }
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const labelColor = isPoppins && poppinsBusy
            ? poppinsTone
            : isFocused
            ? isPoppins
              ? accentPrimary
              : color
            : isRewards && canAffordRedeem && rewardsLabel === 'Redeem'
              ? accentPrimary
              : inactive;

          const tourTargetId = TAB_TOUR_TARGET[route.name as TabRoute];
          const shellStyle = [styles.tab, isPoppins && styles.poppinsTab];
          const tabInner = (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabPressable}>
              {isPoppins ? (
                <Animated.View style={{ transform: [{ scale: poppinsPulse }] }}>
                <LinearGradient
                  colors={
                    poppinsBusy
                      ? ([poppinsTone, `${poppinsTone}AA`] as const)
                      : isFocused
                        ? [accentPrimary, accentSecondary]
                        : [...poppinsIdleColors]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.poppinsButton,
                    isFocused || poppinsBusy
                      ? styles.poppinsButtonActive
                      : styles.poppinsButtonInactive,
                    {
                      borderColor: `${poppinsTone}66`,
                      shadowColor: poppinsTone,
                    },
                  ]}>
                  <IconSymbol
                    name={icon}
                    size={20}
                    color={isFocused || poppinsBusy ? ink : accentPrimary}
                  />
                </LinearGradient>
                </Animated.View>
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
              {keyboardUp ? null : isRewards ? (
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
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
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

          // Outer shell owns flex:1 once (pre-2dda540 layout). TourTarget only measures.
          if (tourTargetId) {
            return (
              <TourTarget key={route.key} id={tourTargetId} style={shellStyle}>
                {tabInner}
              </TourTarget>
            );
          }
          return (
            <View key={route.key} style={shellStyle}>
              {tabInner}
            </View>
          );
        })}

        {/* Shared tablet fifth button — N double-arrows (not Poppins stars). */}
        {fifthSlot === 'switch' ? (
          <TourTarget id="tabbar.switch" style={[styles.tab, styles.poppinsTab]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch who's on — ${switchPeopleCount} people`}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
                void markNeedsProfilePick(members).then(() =>
                  router.replace('/select-profile' as never)
                );
              }}
              style={styles.tabPressable}>
              <LinearGradient
                colors={[accentPrimary, accentSecondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.poppinsButton,
                  styles.poppinsButtonActive,
                  { borderColor: `${accentPrimary}66`, shadowColor: accentPrimary },
                ]}>
              <SwitchPeopleIcon count={switchPeopleCount} size={22} color={ink} />
              </LinearGradient>
              {keyboardUp ? null : (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[styles.label, styles.poppinsLabel, { color: accentPrimary }]}>
                  Switch
                </Text>
              )}
            </Pressable>
          </TourTarget>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: space.sm,
  },
  barCompact: {
    paddingBottom: 4,
    paddingTop: 6,
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
  /** Hit target fills the shell without re-applying flex:1. */
  tabPressable: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
    width: '100%',
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

/**
 * The payment page, light: logo, one line, two plan cards, one button (Duolingo-style calm).
 * Moves a little: drifting colour behind, bouncy cards, a burst on the button. Halloween
 * version when the seasonal theme is on. Presentation only; purchase logic lives in the screen.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import { formatStoreFraction, type StorePrice } from '@/lib/billing/iap';
import type { PaywallCopy } from '@/lib/billing/subscription-status';
import { AppText as Text } from '@/components/orbit/app-text';
import {
  BILLING_TRIAL_DAYS,
  IAP_PRODUCTS,
  type IapProductKey,
} from '@/constants/billing';
import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { BrandTile, Burst, LivingBackground, PaywallMessage } from '@/components/orbit/billing/paywall-decor';
import {
  BatFlyby,
  Cobweb,
  DanglingSpider,
  HalloweenKitten,
  SeasonMonster,
} from '@/components/orbit/seasonal/halloween-decor';
import { useSeasonal } from '@/lib/theme/seasonal';
import * as Haptics from 'expo-haptics';

export type PremiumUsagePanel = {
  tokensUsedThisPeriod: number;
  tokensPerMonth: number;
  periodResetsAt: string;
  topUpBalance: number;
  onBuyMore?: () => void;
};

export type PremiumPaywallProps = {
  /** onboarding shows Not now; settings shows Close */
  variant: 'onboarding' | 'settings';
  busy?: boolean;
  alreadyPremium?: boolean;
  /** Inline success / restore / error — never Alert theatre */
  statusMessage?: string | null;
  errorMessage?: string | null;
  usage?: PremiumUsagePanel | null;
  /** Start trial for the selected billing period */
  onStartTrial: (period: IapProductKey) => void;
  onRestore: () => void;
  onContinue: () => void;
  onDismiss: () => void;
  /**
   * False when the paywall is the gate itself — after sign-up, or once a trial has ended.
   * There is then no "Not now" into the app; the way out is Account, which must always lead
   * to deleting the account (guideline 5.1.1(v)).
   */
  dismissible?: boolean;
  /** Shown in place of the dismiss link when the paywall cannot be dismissed. */
  onAccount?: () => void;
  /**
   * Whether purchasing each plan starts a free trial for this Apple ID, per StoreKit. Where it
   * is false the screen must not mention a trial at all: Apple will charge on the spot.
   * Missing entries count as eligible — the purchase sheet Apple shows is the final word.
   */
  trialEligibleByPeriod?: Partial<Record<IapProductKey, boolean>>;
  /** One line above the price, e.g. "Your free trial has ended." */
  notice?: string | null;
  /** Rendered last, for sheets that belong to this screen. */
  footerSlot?: ReactNode;
  /**
   * StoreKit's own prices for this storefront, keyed by product id. Shown in preference to the
   * USD catalogue, which is only a fallback for Expo Go: a price on screen that differs from
   * Apple's purchase sheet is a guideline 3.1.2 rejection.
   */
  storePrices?: Record<string, StorePrice>;
  /**
   * Which version of the page: start a trial, trial ended, welcome back / renew, or subscribe.
   * Decides the headline, the button and whether a trial is mentioned anywhere at all.
   */
  copy?: PaywallCopy | null;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PERIOD_OPTIONS: { value: IapProductKey; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export function PremiumPaywall({
  variant,
  busy = false,
  alreadyPremium = false,
  statusMessage,
  errorMessage,
  usage = null,
  onStartTrial,
  onRestore,
  onContinue,
  onDismiss,
  dismissible = true,
  onAccount,
  trialEligibleByPeriod,
  notice = null,
  footerSlot = null,
  storePrices = {},
  copy = null,
}: PremiumPaywallProps) {
  const insets = useSafeAreaInsets();
  const { accentTheme, orbitPalette } = useOrbit();
  const { c, isDark } = useOrbitColors();
  const press = useSharedValue(1);
  const priceOpacity = useSharedValue(1);
  const [period, setPeriod] = useState<IapProductKey>('yearly');

  useEffect(() => {
    press.value = 1;
  }, [press]);

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const priceStyle = useAnimatedStyle(() => ({
    opacity: priceOpacity.value,
  }));

  const revealPeriod = useCallback((next: IapProductKey) => {
    setPeriod(next);
    priceOpacity.value = withTiming(1, { duration: 180 });
  }, [priceOpacity]);

  const onPeriodChange = useCallback(
    (next: IapProductKey) => {
      if (next === period || busy) return;
      priceOpacity.value = withTiming(0, { duration: 120 }, (finished) => {
        if (finished) runOnJS(revealPeriod)(next);
      });
    },
    [busy, period, priceOpacity, revealPeriod]
  );

  // The page's mode has the last word: a house that already had its trial is never offered one,
  // whatever this Apple ID's eligibility says.
  const trialEligible = copy ? copy.offersTrial && (trialEligibleByPeriod?.[period] ?? true) : (trialEligibleByPeriod?.[period] ?? true);
  const yearly = IAP_PRODUCTS.yearly;
  const monthly = IAP_PRODUCTS.monthly;
  const selected = period === 'yearly' ? yearly : monthly;
  const priceOf = (p: { productId: string; priceUsd: number }) =>
    storePrices[p.productId]?.display ?? `$${p.priceUsd}`;
  const yearlyPerMonth =
    formatStoreFraction(storePrices[yearly.productId], 12) ?? `$${(yearly.priceUsd / 12).toFixed(2)}`;
  const secondaryLabel = variant === 'onboarding' ? 'Not now' : 'Close';
  const ctaLabel = alreadyPremium
    ? 'Continue'
    : trialEligible
      ? period === 'yearly'
        ? 'Start yearly free trial'
        : 'Start monthly free trial'
      : period === 'yearly'
        ? 'Subscribe yearly'
        : 'Subscribe monthly';
  const fallbackCta = trialEligible ? 'Start Free Trial' : 'Subscribe';
  const ctaText = alreadyPremium
    ? 'Continue'
    : copy && !(copy.offersTrial && !trialEligible)
      ? copy.cta
      : fallbackCta;
  const offerLine = trialEligible
    ? `${BILLING_TRIAL_DAYS} days free, then ${priceOf(selected)}/${period === 'yearly' ? 'year' : 'month'}`
    : `${priceOf(selected)}/${period === 'yearly' ? 'year' : 'month'}`;

  const halloween = useSeasonal().halloween;
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(0);
  const savings = yearly.savingsLabel;
  const onCta = () => {
    if (busy) return;
    setBurst((n) => n + 1);
    setPop((n) => n + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (alreadyPremium) onContinue();
    else onStartTrial(period);
  };
  const pick = (next: IapProductKey) => {
    if (next === period || busy) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setPop((n) => n + 1);
    onPeriodChange(next);
  };

  return (
    <View style={[styles.root, { backgroundColor: halloween ? '#120B24' : orbitPalette.background }]}>
      <LivingBackground color={accentTheme.primary} secondary={accentTheme.secondary ?? accentTheme.primary} halloween={halloween} />
      {halloween ? (
        <>
          <Cobweb corner="tl" size={110} style={{ position: 'absolute', left: 0, top: 0 }} />
          <BatFlyby top={insets.top + 120} every={9000} />
        </>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {!dismissible && onAccount ? (
          <Pressable
            onPress={onAccount}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Account and settings: sign out, transfer or delete the household, delete account, help"
            style={({ pressed }) => [
              styles.accountChip,
              { backgroundColor: glassFill(isDark || halloween), borderColor: `${accentTheme.primary}55`, opacity: pressed ? 0.7 : 1 },
            ]}>
            <MaterialIcons name="settings" size={18} color={accentTheme.primary} />
            <Text style={[styles.accountChipText, { color: halloween ? '#F5EEFF' : c.text }]}>Account</Text>
          </Pressable>
        ) : dismissible ? (
          <Pressable
            onPress={onDismiss}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            style={[styles.closeBtn, { backgroundColor: glassFill(isDark || halloween) }]}>
            <MaterialIcons name="close" size={22} color={halloween ? '#F5EEFF' : c.text} />
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.hero}>
        <Animated.View entering={FadeInUp.delay(40).duration(520)} style={styles.heroInner}>
          <View>
            <BrandTile size={104} pop={pop} />
            {halloween ? <SeasonMonster size={52} style={styles.monster} /> : null}
          </View>
          <Text style={[styles.headline, { color: halloween ? '#F5EEFF' : c.text }]}>
            {copy && !alreadyPremium ? copy.title : 'ChoreMaxx'}
          </Text>
          {copy && !alreadyPremium ? (
            <Text style={[styles.highlight, { color: accentTheme.primary }]}>{copy.kicker}</Text>
          ) : null}
          <Animated.View style={[styles.priceCrossfade, priceStyle]}>
            <Text style={[styles.support, { color: halloween ? '#C7B9E6' : c.textMuted }]}>
              {alreadyPremium && usage
                ? `${usage.tokensUsedThisPeriod} of ${usage.tokensPerMonth} actions used this period`
                : offerLine}
            </Text>
          </Animated.View>
        </Animated.View>
        {halloween ? <HalloweenKitten size={60} style={styles.kitten} /> : null}
      </View>

      <Animated.View
        entering={FadeInUp.delay(140).duration(520)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        {!alreadyPremium ? (
          <View style={styles.plans}>
            {PERIOD_OPTIONS.slice().reverse().map((opt) => (
              <PlanCard
                key={opt.value}
                label={opt.label}
                price={priceOf(opt.value === 'yearly' ? yearly : monthly)}
                per={opt.value === 'yearly' ? 'per year' : 'per month'}
                sub={opt.value === 'yearly' ? `About ${yearlyPerMonth} a month` : 'Flexible'}
                badge={opt.value === 'yearly' ? savings : null}
                selected={period === opt.value}
                accent={accentTheme.primary}
                dark={isDark || halloween}
                disabled={busy}
                onPress={() => pick(opt.value)}
              />
            ))}
          </View>
        ) : null}

        {statusMessage ? <PaywallMessage tone="success" message={statusMessage} dark={isDark || halloween} /> : null}
        {errorMessage ? <PaywallMessage tone="error" message={errorMessage} dark={isDark || halloween} /> : null}
        {notice ? <PaywallMessage tone="info" message={notice} dark={isDark || halloween} /> : null}
        <Text style={[styles.reassure, { color: halloween ? '#C7B9E6' : c.textMuted }]}>Cancel anytime, no penalties or fees</Text>

        <View>
          <AnimatedPressable
            disabled={busy}
            onPressIn={() => {
              press.value = withSpring(0.96, motion.snappy);
            }}
            onPressOut={() => {
              press.value = withSpring(1, motion.snappy);
            }}
            onPress={onCta}
            style={[
              styles.cta,
              ctaStyle,
              {
                backgroundColor: accentTheme.primary,
                borderBottomColor: `${accentTheme.primary}`,
                shadowColor: accentTheme.primary,
                opacity: busy ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}>
            <View style={styles.ctaLip} />
            <Text style={styles.ctaLabel}>{busy ? 'Please wait…' : ctaText.toUpperCase()}</Text>
          </AnimatedPressable>
          {halloween ? (
            <View pointerEvents="none" style={styles.ctaSpider}>
              <DanglingSpider thread={14} size={14} />
            </View>
          ) : null}
          <Burst trigger={burst} halloween={halloween} color={accentTheme.primary} />
        </View>

        {dismissible ? (
          <Pressable onPress={onDismiss} disabled={busy} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.secondary, { color: accentTheme.primary }]}>{secondaryLabel.toUpperCase()}</Text>
          </Pressable>
        ) : null}

        {/* Required by Apple next to the button (3.1.2): price, period, auto-renewal, how to cancel. */}
        <Text style={[styles.legal, { color: halloween ? '#9D8FBF' : c.textSubtle }]}>
          {offerLine}.{' '}
          {trialEligible
            ? 'Payment is charged to your Apple ID when the trial ends'
            : 'Payment is charged to your Apple ID when you confirm'}
          {' '}and renews automatically unless cancelled at least 24 hours before the end of the
          period, in your Apple ID settings under Subscriptions.
        </Text>

        <View style={styles.links}>
          <Pressable
            onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl)}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use">
            <Text style={[styles.link, { color: halloween ? '#C7B9E6' : c.textMuted }]}>Terms</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable
            onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl)}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy">
            <Text style={[styles.link, { color: halloween ? '#C7B9E6' : c.textMuted }]}>Privacy</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable onPress={onRestore} disabled={busy} hitSlop={12}>
            <Text style={[styles.link, { color: halloween ? '#C7B9E6' : c.textMuted }]}>Restore</Text>
          </Pressable>
        </View>
      </Animated.View>
      {footerSlot}
    </View>
  );
}

/** One plan as a card: lifts and gets a coloured edge when chosen. */
function PlanCard({
  label,
  price,
  per,
  sub,
  badge,
  selected,
  accent,
  dark,
  disabled,
  onPress,
}: {
  label: string;
  price: string;
  per: string;
  sub: string;
  badge: string | null;
  selected: boolean;
  accent: string;
  dark: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, { damping: 12, stiffness: 220 });
  }, [lift, selected]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * lift.value }, { scale: 1 + 0.02 * lift.value }],
  }));
  const text = dark ? '#F5EEFF' : '#2A1F1A';
  const muted = dark ? 'rgba(235,225,255,0.7)' : 'rgba(42,31,26,0.6)';
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${price} ${per}`}
      style={[
        styles.plan,
        style,
        {
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
          borderColor: selected ? accent : dark ? 'rgba(255,255,255,0.14)' : 'rgba(42,31,26,0.1)',
          borderBottomWidth: selected ? 4 : 2,
        },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <Text style={[styles.planLabel, { color: text }]}>{label}</Text>
          {badge ? (
            <View style={[styles.planBadge, { backgroundColor: accent }]}>
              <Text style={styles.planBadgeText}>{badge.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.planSub, { color: muted }]}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.planPrice, { color: text }]}>{price}</Text>
        <Text style={[styles.planSub, { color: muted }]}>{per}</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  heroInner: { alignItems: 'center', gap: 12 },
  monster: { position: 'absolute', right: -40, top: -18 },
  kitten: { bottom: 6, left: 18, position: 'absolute' },
  plans: { gap: 10 },
  plan: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  planLabel: { fontSize: 17, fontWeight: '600' },
  planSub: { fontSize: 13 },
  planPrice: { fontSize: 17, fontWeight: '700' },
  planBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  planBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  ctaLip: { backgroundColor: 'rgba(0,0,0,0.18)', bottom: 0, height: 4, left: 0, position: 'absolute', right: 0 },
  ctaSpider: { position: 'absolute', right: 26, top: -20 },
  secondary: { fontSize: 15, fontWeight: '700', letterSpacing: 0.4, paddingVertical: 4, textAlign: 'center' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg },
  closeBtn: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  brandPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, transform: [{ skewX: '-10deg' }] },
  brandPillText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  highlight: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, textAlign: 'center' },
  markWrap: { alignItems: 'center', height: 150, justifyContent: 'center' },
  halo: { borderRadius: 80, height: 150, position: 'absolute', width: 150 },
  sheet: {
    gap: 10,
    paddingHorizontal: space.xl,
    paddingTop: 8,
  },
  reassure: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  root: {
    flex: 1,
  },
  mark: {
    alignItems: 'center',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: space.xl,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginTop: 10,
    textAlign: 'center',
  },
  support: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  segmentWrap: {
    alignSelf: 'stretch',
  },
  priceBlock: {
    alignItems: 'center',
    gap: 10,
    minHeight: 88,
  },
  priceCrossfade: {
    alignItems: 'center',
    gap: 8,
  },
  notice: { fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  trialPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  trialText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  priceLine: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  pricePeriod: {
    fontSize: 17,
    fontWeight: '400',
  },
  subPrice: {
    fontSize: 14,
    fontWeight: '400',
  },
  usageCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.xxs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  usageTitle: {
    ...typography.headline,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 2,
  },
  usageLine: {
    ...typography.footnote,
  },
  buyMore: {
    marginTop: space.xs,
  },
  footer: {
    gap: space.sm + 2,
  },
  status: {
    ...typography.subheadline,
    fontWeight: '500',
    textAlign: 'center',
  },
  error: {
    ...typography.footnote,
    textAlign: 'center',
  },
  cta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 56,
    overflow: 'hidden',
    paddingHorizontal: space.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  legal: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  link: {
    fontSize: 15,
    fontWeight: '500',
  },
  dot: {
    fontSize: 15,
  },
  accountChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    position: 'absolute',
    right: space.lg,
    zIndex: 2,
  },
  accountChipText: { fontSize: 15, fontWeight: '700' },
  kicker: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  headlineMode: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
  },
});

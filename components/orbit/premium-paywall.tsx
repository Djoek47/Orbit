/**
 * Apple-caliber Premium subscription sheet — Monthly/Yearly segment + price crossfade.
 * Presentation only; purchase logic lives in the screen / facade.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  withDelay,
  withRepeat,
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
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import {
  BILLING_TRIAL_DAYS,
  IAP_PRODUCTS,
  PREMIUM_ALLOWANCE_COPY,
  type IapProductKey,
} from '@/constants/billing';
import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

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
  // Apple sets the first charge for the day the trial ends; say the date, so nobody is surprised.
  const firstCharge = new Date(Date.now() + BILLING_TRIAL_DAYS * 86_400_000).toLocaleDateString(
    'en-US',
    { month: 'long', day: 'numeric' }
  );

  const offerLine = trialEligible
    ? `${BILLING_TRIAL_DAYS} days free, then ${priceOf(selected)}/${period === 'yearly' ? 'year' : 'month'}`
    : `${priceOf(selected)}/${period === 'yearly' ? 'year' : 'month'}`;

  return (
    <View style={[styles.root, { backgroundColor: orbitPalette.background }]}>
      {/* Hero: a deep wash of the household's colour, with a few stars that drift and twinkle. */}
      <LinearGradient
        colors={[`${accentTheme.primary}55`, `${accentTheme.secondary ?? accentTheme.primary}22`, orbitPalette.background]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Sparkles color={accentTheme.primary} />

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
              { backgroundColor: glassFill(isDark), borderColor: `${accentTheme.primary}55`, opacity: pressed ? 0.7 : 1 },
            ]}>
            <MaterialIcons name="settings" size={18} color={accentTheme.primary} />
            <Text style={[styles.accountChipText, { color: c.text }]}>Account</Text>
          </Pressable>
        ) : dismissible ? (
          <Pressable
            onPress={onDismiss}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            style={[styles.closeBtn, { backgroundColor: glassFill(isDark) }]}>
            <MaterialIcons name="close" size={22} color={c.text} />
          </Pressable>
        ) : (
          <View />
        )}
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary ?? accentTheme.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandPill}>
          <Text style={styles.brandPillText}>CHOREMAXX</Text>
        </LinearGradient>
      </View>

      <View style={styles.hero}>
        <Animated.View entering={FadeInUp.delay(40).duration(480)} style={{ alignItems: 'center', gap: 10 }}>
          <Text style={[styles.headline, { color: c.text }]}>
            {copy && !alreadyPremium ? copy.title : 'ChoreMaxx'}
          </Text>
          {copy && !alreadyPremium ? (
            <Text style={[styles.highlight, { color: accentTheme.primary }]}>{copy.kicker}</Text>
          ) : null}
          {copy && !alreadyPremium && copy.body ? (
            <Text style={[styles.support, { color: c.textMuted }]}>{copy.body}</Text>
          ) : null}
        </Animated.View>
        <FloatingMark />
      </View>

      {/* The sheet: a soft curved card rising from the bottom, holding the choice and the button. */}
      <Animated.View
        entering={FadeInUp.delay(120).duration(520)}
        style={[
          styles.sheet,
          {
            backgroundColor: isDark ? '#FFFFFF0D' : '#FFFFFFE6',
            borderColor: `${accentTheme.primary}33`,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}>
        {!alreadyPremium ? (
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={onPeriodChange} disabled={busy} />
        ) : null}

        <Animated.View style={[styles.priceCrossfade, priceStyle]}>
          {trialEligible || period === 'yearly' ? (
            <View style={[styles.trialPill, { backgroundColor: `${accentTheme.primary}1F` }]}>
              <Text style={[styles.trialText, { color: accentTheme.primary }]}>
                {trialEligible ? `Free for ${BILLING_TRIAL_DAYS} days` : ''}
                {trialEligible && period === 'yearly' ? ' · ' : ''}
                {period === 'yearly' ? yearly.savingsLabel : ''}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.priceLine, { color: c.text }]}>
            {priceOf(selected)}
            <Text style={[styles.pricePeriod, { color: c.textMuted }]}>
              {period === 'yearly' ? ' / year' : ' / month'}
            </Text>
          </Text>
          <Text style={[styles.subPrice, { color: c.textMuted }]}>
            {period === 'yearly'
              ? `About ${yearlyPerMonth}/mo, billed yearly`
              : `Or ${priceOf(yearly)}/year — ${yearly.savingsLabel}`}
          </Text>
        </Animated.View>

        {alreadyPremium && usage ? (
          <Text style={[styles.subPrice, { color: c.textMuted }]}>
            {usage.tokensUsedThisPeriod} of {usage.tokensPerMonth} actions used this period
          </Text>
        ) : null}

        {statusMessage ? <Text style={[styles.status, { color: accentTheme.primary }]}>{statusMessage}</Text> : null}
        {errorMessage ? <Text style={[styles.error, { color: c.danger }]}>{errorMessage}</Text> : null}

        <Text style={[styles.reassure, { color: c.textMuted }]}>Cancel anytime, no penalties or fees</Text>

        <AnimatedPressable
          disabled={busy}
          onPressIn={() => {
            press.value = withSpring(0.97, motion.snappy);
          }}
          onPressOut={() => {
            press.value = withSpring(1, motion.snappy);
          }}
          onPress={() => {
            if (alreadyPremium) onContinue();
            else onStartTrial(period);
          }}
          style={[styles.cta, ctaStyle, { backgroundColor: accentTheme.primary, opacity: busy ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}>
          <Text style={[styles.ctaLabel, { color: isDark ? '#0A1018' : '#FFFFFF' }]}>
            {busy ? 'Please wait…' : ctaText}
          </Text>
        </AnimatedPressable>

        {/* Required by Apple next to the button (3.1.2): price, period, auto-renewal, how to cancel. */}
        <Text style={[styles.legal, { color: c.textSubtle }]}>
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
            <Text style={[styles.link, { color: c.textMuted }]}>Terms</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable
            onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl)}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy">
            <Text style={[styles.link, { color: c.textMuted }]}>Privacy</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable onPress={onRestore} disabled={busy} hitSlop={12}>
            <Text style={[styles.link, { color: c.textMuted }]}>Restore</Text>
          </Pressable>
          {dismissible ? (
            <>
              <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
              <Pressable onPress={onDismiss} disabled={busy} hitSlop={12}>
                <Text style={[styles.link, { color: c.textMuted }]}>{secondaryLabel}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </Animated.View>
      {notice ? null : null}
      {footerSlot}
    </View>
  );
}

/** Four small stars that twinkle and drift — life without illustrations. */
function Sparkles({ color }: { color: string }) {
  const spots = [
    { top: '14%', left: '12%', size: 14, delay: 0 },
    { top: '22%', left: '82%', size: 10, delay: 700 },
    { top: '34%', left: '20%', size: 9, delay: 1300 },
    { top: '30%', left: '70%', size: 16, delay: 400 },
  ] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {spots.map((spot, i) => (
        <Star key={i} {...spot} color={color} />
      ))}
    </View>
  );
}

function Star({
  top,
  left,
  size,
  delay,
  color,
}: {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  delay: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.65,
    transform: [{ translateY: -6 * t.value }, { scale: 0.8 + t.value * 0.35 }],
  }));
  return (
    <Animated.Text style={[{ position: 'absolute', top, left, fontSize: size, color }, style]}>✦</Animated.Text>
  );
}

/** The house mark, floating gently in a soft halo. */
function FloatingMark() {
  const { accentTheme } = useOrbit();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * t.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + 0.3 * t.value, transform: [{ scale: 0.95 + 0.1 * t.value }] }));
  return (
    <View style={styles.markWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: `${accentTheme.primary}33` }, halo]} />
      <Animated.View style={float}>
        <ChoremaxxLogo size="lg" variant="icon" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg },
  closeBtn: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  brandPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, transform: [{ skewX: '-10deg' }] },
  brandPillText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  highlight: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  markWrap: { alignItems: 'center', height: 150, justifyContent: 'center' },
  halo: { borderRadius: 80, height: 150, position: 'absolute', width: 150 },
  sheet: {
    borderCurve: 'continuous',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    gap: 12,
    paddingHorizontal: space.xl,
    paddingTop: 22,
  },
  reassure: { fontSize: 14.5, fontWeight: '600', marginTop: 4, textAlign: 'center' },
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
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    textAlign: 'center',
  },
  support: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 14,
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
    borderRadius: radius.cardLarge,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: space.xl,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
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

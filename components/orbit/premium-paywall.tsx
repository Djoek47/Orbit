/**
 * Apple-caliber Premium subscription sheet — Monthly/Yearly segment + price crossfade.
 * Presentation only; purchase logic lives in the screen / facade.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
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
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PERIOD_OPTIONS: { value: IapProductKey; label: string }[] = [
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
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

  const trialEligible = trialEligibleByPeriod?.[period] ?? true;
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
  const ctaText = alreadyPremium ? 'Continue' : trialEligible ? 'Start Free Trial' : 'Subscribe';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: orbitPalette.background,
          paddingTop: insets.top + 28,
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}>
      <Animated.View entering={FadeIn.duration(420)} style={styles.mark}>
        <ChoremaxxLogo size="md" variant="icon" />
      </Animated.View>

      <View style={styles.hero}>
        <Animated.View entering={FadeInUp.delay(40).duration(480)}>
          <Text style={[styles.headline, { color: c.text }]}>Choremaxx Premium</Text>
          <Text style={[styles.support, { color: c.textMuted }]}>
            {PREMIUM_ALLOWANCE_COPY}
          </Text>
        </Animated.View>

        {!alreadyPremium ? (
          <Animated.View entering={FadeInUp.delay(100).duration(420)} style={styles.segmentWrap}>
            <SegmentedControl
              options={PERIOD_OPTIONS}
              value={period}
              onChange={onPeriodChange}
              disabled={busy}
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInUp.delay(120).duration(480)} style={styles.priceBlock}>
          {notice ? (
            <Text style={[styles.notice, { color: c.text }]}>{notice}</Text>
          ) : null}
          {trialEligible || period === 'yearly' ? (
            <View style={[styles.trialPill, { backgroundColor: `${accentTheme.primary}18` }]}>
              <Text style={[styles.trialText, { color: accentTheme.primary }]}>
                {trialEligible ? `Free for ${BILLING_TRIAL_DAYS} days` : ''}
                {trialEligible && period === 'yearly' ? ' · ' : ''}
                {period === 'yearly' ? yearly.savingsLabel : ''}
              </Text>
            </View>
          ) : null}
          <Animated.View style={[styles.priceCrossfade, priceStyle]}>
            <Text style={[styles.priceLine, { color: c.text }]}>
              {priceOf(selected)}
              <Text style={[styles.pricePeriod, { color: c.textMuted }]}>
                {period === 'yearly' ? ' / year' : ' / month'}
              </Text>
            </Text>
            <Text style={[styles.subPrice, { color: c.textMuted }]}>
              {period === 'yearly'
                ? `About ${yearlyPerMonth}/mo · ${priceOf(yearly)}/year (${yearly.savingsLabel})`
                : `Or ${priceOf(yearly)}/year at ${yearly.savingsLabel} · ${priceOf(monthly)}/month`}
            </Text>
          </Animated.View>
        </Animated.View>

        {alreadyPremium && usage ? (
          <Animated.View
            entering={FadeInUp.delay(160).duration(420)}
            style={[
              styles.usageCard,
              {
                backgroundColor: glassFill(isDark),
                borderColor: `${accentTheme.primary}44`,
              },
            ]}>
            <Text style={[styles.usageTitle, { color: c.text }]}>Your actions</Text>
            <Text style={[styles.usageLine, { color: c.textMuted }]}>
              {usage.tokensUsedThisPeriod} of {usage.tokensPerMonth} this period
            </Text>
            <Text style={[styles.usageLine, { color: c.textSubtle }]}>
              Resets {new Date(usage.periodResetsAt).toLocaleDateString()}
              {usage.topUpBalance ? ` · ${usage.topUpBalance} top-up` : ''}
            </Text>
            {usage.onBuyMore ? (
              <Pressable onPress={usage.onBuyMore} hitSlop={8} style={styles.buyMore}>
                <Text style={[styles.link, { color: accentTheme.primary }]}>Buy more actions</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={FadeInUp.delay(200).duration(420)} style={styles.footer}>
        {statusMessage ? (
          <Text style={[styles.status, { color: accentTheme.primary }]}>{statusMessage}</Text>
        ) : null}
        {errorMessage ? (
          <Text style={[styles.error, { color: c.danger }]}>{errorMessage}</Text>
        ) : null}

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
          style={[
            styles.cta,
            ctaStyle,
            {
              backgroundColor: accentTheme.primary,
              opacity: busy ? 0.55 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}>
          <Text style={[styles.ctaLabel, { color: isDark ? '#0A1018' : '#FFFFFF' }]}>
            {busy ? 'Please wait…' : ctaText}
          </Text>
        </AnimatedPressable>

        <Text style={[styles.legal, { color: c.textSubtle }]}>
          {trialEligible
            ? 'Payment is charged to your Apple ID after the trial unless you cancel at least 24 hours before it ends. Manage it in your Apple ID settings, under Subscriptions.'
            : 'Payment is charged to your Apple ID when you confirm. Manage it in your Apple ID settings, under Subscriptions.'}
        </Text>

        <Text style={[styles.legal, { color: c.textSubtle }]}>
          Subscriptions renew automatically unless cancelled at least 24 hours before the end of
          the period. Any unused part of a free trial is forfeited when a subscription is bought.
        </Text>

        {/* Guideline 3.1.2 — a subscription screen must link to both from the screen itself. */}
        <View style={styles.links}>
          <Pressable
            onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl)}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use">
            <Text style={[styles.link, { color: c.textMuted }]}>Terms of Use</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable
            onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl)}
            disabled={busy}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy">
            <Text style={[styles.link, { color: c.textMuted }]}>Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={styles.links}>
          <Pressable onPress={onRestore} disabled={busy} hitSlop={12}>
            <Text style={[styles.link, { color: c.textMuted }]}>Restore</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          {dismissible ? (
            <Pressable onPress={onDismiss} disabled={busy} hitSlop={12}>
              <Text style={[styles.link, { color: c.textMuted }]}>{secondaryLabel}</Text>
            </Pressable>
          ) : onAccount ? (
            <Pressable
              onPress={onAccount}
              disabled={busy}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Account: sign out, delete account, support">
              <Text style={[styles.link, { color: c.textMuted }]}>Account</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
      {footerSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  mark: {
    alignItems: 'center',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
    paddingBottom: space.xl,
  },
  headline: {
    fontSize: 40,
    fontWeight: '300',
    letterSpacing: -1.1,
    lineHeight: 46,
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
});

/**
 * Apple-caliber Premium subscription sheet — one composition, one decision.
 * Presentation only; purchase logic lives in the screen / facade.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { BILLING_TRIAL_DAYS, IAP_PRODUCTS } from '@/constants/billing';
import { motion } from '@/constants/motion-tokens';
import { radius, space } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export type PremiumPaywallProps = {
  /** onboarding shows Not now; settings shows Close */
  variant: 'onboarding' | 'settings';
  busy?: boolean;
  alreadyPremium?: boolean;
  /** Inline success / restore / error — never Alert theatre */
  statusMessage?: string | null;
  errorMessage?: string | null;
  onStartTrial: () => void;
  onRestore: () => void;
  onContinue: () => void;
  onDismiss: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PremiumPaywall({
  variant,
  busy = false,
  alreadyPremium = false,
  statusMessage,
  errorMessage,
  onStartTrial,
  onRestore,
  onContinue,
  onDismiss,
}: PremiumPaywallProps) {
  const insets = useSafeAreaInsets();
  const { accentTheme, orbitPalette } = useOrbit();
  const { c, isDark } = useOrbitColors();
  const press = useSharedValue(1);

  useEffect(() => {
    press.value = 1;
  }, [press]);

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const monthly = IAP_PRODUCTS.monthly;
  const secondaryLabel = variant === 'onboarding' ? 'Not now' : 'Close';

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
            {BILLING_TRIAL_DAYS} days free, then ${monthly.priceUsd}/month.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(480)} style={styles.priceBlock}>
          <View style={[styles.trialPill, { backgroundColor: `${accentTheme.primary}18` }]}>
            <Text style={[styles.trialText, { color: accentTheme.primary }]}>
              Free for {BILLING_TRIAL_DAYS} days
            </Text>
          </View>
          <Text style={[styles.priceLine, { color: c.text }]}>
            ${monthly.priceUsd}
            <Text style={[styles.pricePeriod, { color: c.textMuted }]}> / month</Text>
          </Text>
        </Animated.View>
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
            else onStartTrial();
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
          accessibilityLabel={
            alreadyPremium ? 'Continue' : 'Start free trial'
          }>
          <Text style={[styles.ctaLabel, { color: isDark ? '#0A1018' : '#FFFFFF' }]}>
            {busy
              ? 'Please wait…'
              : alreadyPremium
                ? 'Continue'
                : 'Start Free Trial'}
          </Text>
        </AnimatedPressable>

        <Text style={[styles.legal, { color: c.textSubtle }]}>
          Payment is charged to your Apple ID after the trial unless you cancel at least
          24 hours before it ends. Manage in Settings → Apple ID → Subscriptions.
        </Text>

        <View style={styles.links}>
          <Pressable onPress={onRestore} disabled={busy} hitSlop={12}>
            <Text style={[styles.link, { color: c.textMuted }]}>Restore</Text>
          </Pressable>
          <Text style={[styles.dot, { color: c.textSubtle }]}>·</Text>
          <Pressable onPress={onDismiss} disabled={busy} hitSlop={12}>
            <Text style={[styles.link, { color: c.textMuted }]}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </Animated.View>
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
    gap: 36,
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
  priceBlock: {
    alignItems: 'center',
    gap: 14,
  },
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
  footer: {
    gap: 14,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
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

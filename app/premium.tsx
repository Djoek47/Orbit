/**
 * Premium trial paywall — shown after email confirm during onboarding.
 * Character: Apple-calm, one hero decision — start 7-day free trial → $4.99/mo.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { BILLING_TRIAL_DAYS, IAP_PRODUCTS } from '@/constants/billing';
import { radius, space } from '@/constants/orbit-theme';
import {
  fetchEntitlement,
  isPremiumActive,
  premiumCopy,
  purchasePremium,
  restorePurchases,
  type EntitlementState,
} from '@/lib/billing/iap';
import { setPremiumOnboardingGate } from '@/lib/billing/premium-onboarding';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const BENEFITS = [
  { icon: 'auto-awesome' as const, label: 'Poppins co-manager', detail: 'Household briefings, fairness, Plan ideas' },
  { icon: 'groups' as const, label: 'Whole family', detail: 'Tasks, Rewards, Plan — one calm command center' },
  { icon: 'verified' as const, label: 'Cancel anytime', detail: 'Trial ends → $4.99/mo via Apple. Yearly available later.' },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source?: string }>();
  const fromOnboarding = params.source === 'onboarding' || !params.source;
  const { accentTheme, orbitPalette } = useOrbit();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const [busy, setBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);

  useEffect(() => {
    void fetchEntitlement().then(setEntitlement);
  }, []);

  const continueAfter = async (state: 'started' | 'deferred' | 'skipped') => {
    await setPremiumOnboardingGate(state);
    if (fromOnboarding) {
      router.replace('/welcome' as never);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)' as never);
  };

  const startTrial = async () => {
    setBusy(true);
    try {
      const next = await purchasePremium('monthly');
      setEntitlement(next);
      await setPremiumOnboardingGate('started');
      Alert.alert('Welcome to Premium', premiumCopy(next), [
        {
          text: 'Continue',
          onPress: () => {
            void continueAfter('started');
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Purchase unavailable',
        error instanceof Error
          ? error.message
          : 'Could not start the trial. Try again or continue and start from Settings.'
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const next = await restorePurchases();
      setEntitlement(next);
      if (isPremiumActive(next)) {
        await setPremiumOnboardingGate('started');
        Alert.alert('Restored', premiumCopy(next), [
          { text: 'Continue', onPress: () => void continueAfter('started') },
        ]);
      } else {
        Alert.alert('No purchase found', 'Start a free trial to unlock Premium.');
      }
    } finally {
      setBusy(false);
    }
  };

  const monthly = IAP_PRODUCTS.monthly;
  const alreadyPremium = entitlement ? isPremiumActive(entitlement) : false;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: orbitPalette.background,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}>
      <LinearGradient
        colors={
          isDark
            ? [`${accentTheme.primary}22`, 'transparent', 'transparent']
            : [`${accentTheme.primary}18`, 'transparent', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View entering={FadeIn.duration(400)} style={styles.brand}>
        <ChoremaxxLogo size="lg" variant="icon" />
      </Animated.View>

      <View style={styles.body}>
        <Animated.View entering={FadeInUp.delay(40).duration(420)}>
          <Text style={[styles.eyebrow, { color: c.textSubtle }]}>CHOREMAXX PREMIUM</Text>
          <Text style={[styles.title, { color: c.text }]}>
            Run your household{'\n'}with Poppins
          </Text>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Start your {BILLING_TRIAL_DAYS}-day free trial. Then {`$${monthly.priceUsd}`}/month —
            billed through Apple.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(420)}
          style={[
            styles.priceCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : glass(0.7),
              borderColor: glassBorder(0.1),
            },
          ]}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.text }]}>${monthly.priceUsd}</Text>
            <Text style={[styles.period, { color: c.textMuted }]}>/ month</Text>
          </View>
          <View style={[styles.trialPill, { backgroundColor: `${accentTheme.primary}22` }]}>
            <Text style={[styles.trialPillText, { color: accentTheme.primary }]}>
              {BILLING_TRIAL_DAYS}-day free trial
            </Text>
          </View>
          <Text style={[styles.priceFoot, { color: c.textSubtle }]}>
            {alreadyPremium
              ? premiumCopy(entitlement!)
              : `No charge today. Cancel anytime in Apple Subscriptions.`}
          </Text>
        </Animated.View>

        <View style={styles.benefits}>
          {BENEFITS.map((item, index) => (
            <Animated.View
              key={item.label}
              entering={FadeInDown.delay(140 + index * 50).duration(360)}
              style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: `${accentTheme.primary}18` }]}>
                <MaterialIcons name={item.icon} size={18} color={accentTheme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.benefitLabel, { color: c.text }]}>{item.label}</Text>
                <Text style={[styles.benefitDetail, { color: c.textMuted }]}>{item.detail}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View entering={FadeInUp.delay(220).duration(400)} style={styles.footer}>
        {alreadyPremium ? (
          <OrbitButton disabled={busy} onPress={() => void continueAfter('started')}>
            Continue
          </OrbitButton>
        ) : (
          <OrbitButton disabled={busy} onPress={() => void startTrial()}>
            {busy ? 'Starting…' : `Start ${BILLING_TRIAL_DAYS}-day free trial`}
          </OrbitButton>
        )}

        {busy ? (
          <ActivityIndicator style={{ marginTop: 12 }} color={accentTheme.primary} />
        ) : null}

        <Text style={[styles.legal, { color: c.textSubtle }]}>
          Then ${monthly.priceUsd}/mo. Yearly ${IAP_PRODUCTS.yearly.priceUsd}/yr available in
          Settings. Payment charged to your Apple ID at the end of the trial unless cancelled.
        </Text>

        <View style={styles.secondaryRow}>
          <Pressable onPress={() => void restore()} disabled={busy} hitSlop={10}>
            <Text style={[styles.secondaryLink, { color: c.textMuted }]}>Restore purchases</Text>
          </Pressable>
          {fromOnboarding ? (
            <>
              <Text style={{ color: c.textSubtle }}>·</Text>
              <Pressable
                onPress={() => void continueAfter('deferred')}
                disabled={busy}
                hitSlop={10}>
                <Text style={[styles.secondaryLink, { color: c.textMuted }]}>Not now</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: space.md,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
    paddingBottom: space.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: -0.9,
    lineHeight: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  priceCard: {
    alignItems: 'center',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: space.lg,
    paddingVertical: 22,
  },
  priceRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  price: {
    fontSize: 44,
    fontWeight: '300',
    letterSpacing: -1.2,
  },
  period: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  trialPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  trialPillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  priceFoot: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  benefits: {
    gap: 14,
    paddingHorizontal: 4,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  benefitIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  benefitLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  benefitDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  footer: {
    gap: 10,
    paddingTop: space.sm,
  },
  legal: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  secondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
    paddingBottom: 4,
  },
  secondaryLink: {
    fontSize: 14,
    fontWeight: '500',
  },
});

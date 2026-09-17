/**
 * Premium route — post-email-confirm onboarding soft gate + Settings entry.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PremiumPaywall } from '@/components/orbit/premium-paywall';
import { TokenTopUpPicker } from '@/components/orbit/token-top-up-picker';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { space } from '@/constants/orbit-theme';
import { summarizeAiUsage } from '@/lib/ai/credits';
import { loadAiUsageEvents } from '@/lib/ai/credit-ledger';
import {
  fetchEntitlement,
  isPremiumActive,
  isUserCancelledPurchase,
  premiumCopy,
  purchasePremium,
  purchaseTokens,
  restorePurchases,
  type EntitlementState,
  type IapTokenPackKey,
} from '@/lib/billing/iap';
import { setPremiumOnboardingGate } from '@/lib/billing/premium-onboarding';
import { loadTokenGrants, topUpBalanceFromGrants } from '@/lib/billing/token-grants';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function PremiumScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const fromOnboarding = params.source === 'onboarding' || !params.source;
  const variant = fromOnboarding ? 'onboarding' : 'settings';
  const insets = useSafeAreaInsets();
  const { household, orbitPalette, accentTheme } = useOrbit();
  const { c } = useOrbitColors();
  const members = household.members;

  const [busy, setBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpBalance, setTopUpBalance] = useState(0);
  const [usageSummary, setUsageSummary] = useState(() =>
    summarizeAiUsage(
      [],
      members.map((m) => ({ id: m.id, name: m.name }))
    )
  );

  useEffect(() => {
    void fetchEntitlement().then(setEntitlement);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const events = await loadAiUsageEvents(household?.id);
      const grants = await loadTokenGrants(household?.id);
      if (cancelled) return;
      const balance = topUpBalanceFromGrants(grants);
      setTopUpBalance(balance);
      setUsageSummary(
        summarizeAiUsage(
          events,
          members.map((m) => ({ id: m.id, name: m.name })),
          { topUpBalance: balance }
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [household?.id, members]);

  const refreshUsage = async () => {
    const events = await loadAiUsageEvents(household.id);
    const grants = await loadTokenGrants(household.id);
    const balance = topUpBalanceFromGrants(grants);
    setTopUpBalance(balance);
    setUsageSummary(
      summarizeAiUsage(
        events,
        members.map((m) => ({ id: m.id, name: m.name })),
        { topUpBalance: balance }
      )
    );
  };

  const buyMore = async (pack: IapTokenPackKey) => {
    if (!household?.id) return;
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const grant = await purchaseTokens(pack, household.id);
      setStatusMessage(`Added ${grant.tokens} actions`);
      setShowTopUp(false);
      await refreshUsage();
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        setErrorMessage(null);
      } else {
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not buy more actions.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const usagePanel = useMemo(() => {
    if (!entitlement || !isPremiumActive(entitlement)) return null;
    return {
      tokensUsedThisPeriod: usageSummary.tokensUsedThisPeriod,
      tokensPerMonth: TOKENS_PER_MONTH,
      periodResetsAt: usageSummary.periodResetsAt,
      topUpBalance,
      onBuyMore: () => {
        setErrorMessage(null);
        setShowTopUp(true);
      },
    };
  }, [entitlement, usageSummary, topUpBalance]);

  const leave = async (gate: 'started' | 'deferred' | 'skipped') => {
    await setPremiumOnboardingGate(gate);
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

  const startTrial = async (product: 'yearly' | 'monthly') => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const next = await purchasePremium(product);
      setEntitlement(next);
      setStatusMessage('Trial started');
      await setPremiumOnboardingGate('started');
      await new Promise((r) => setTimeout(r, 700));
      await leave('started');
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        setErrorMessage(null);
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not start the trial. Try again in a moment.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const next = await restorePurchases();
      setEntitlement(next);
      if (isPremiumActive(next)) {
        setStatusMessage(premiumCopy(next));
        await setPremiumOnboardingGate('started');
        await new Promise((r) => setTimeout(r, 700));
        await leave('started');
      } else {
        setErrorMessage('No active subscription found.');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Restore failed. Try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (showTopUp) {
    return (
      <View
        style={[
          styles.topUpRoot,
          {
            backgroundColor: orbitPalette.background,
            paddingTop: insets.top + space.xxl,
            paddingBottom: Math.max(insets.bottom, space.xl),
          },
        ]}>
        <TokenTopUpPicker
          busy={busy}
          onSelect={(pack) => void buyMore(pack)}
          onDismiss={() => setShowTopUp(false)}
        />
        {statusMessage ? (
          <Text style={[styles.status, { color: accentTheme.primary }]}>{statusMessage}</Text>
        ) : null}
        {errorMessage ? (
          <Text style={[styles.error, { color: c.danger }]}>{errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <PremiumPaywall
      variant={variant}
      busy={busy}
      alreadyPremium={entitlement ? isPremiumActive(entitlement) : false}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      usage={usagePanel}
      onStartTrial={() => void startTrial('yearly')}
      onStartMonthly={() => void startTrial('monthly')}
      onRestore={() => void restore()}
      onContinue={() => void leave('started')}
      onDismiss={() => void leave(fromOnboarding ? 'deferred' : 'skipped')}
    />
  );
}

const styles = StyleSheet.create({
  topUpRoot: {
    flex: 1,
    paddingHorizontal: space.xl,
    gap: space.sm,
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
});

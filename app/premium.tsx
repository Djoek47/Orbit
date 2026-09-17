/**
 * Premium route — post-email-confirm onboarding soft gate + Settings entry.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { PremiumPaywall } from '@/components/orbit/premium-paywall';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { summarizeAiUsage } from '@/lib/ai/credits';
import { loadAiUsageEvents } from '@/lib/ai/credit-ledger';
import {
  fetchEntitlement,
  isPremiumActive,
  isUserCancelledPurchase,
  premiumCopy,
  purchasePremium,
  restorePurchases,
  type EntitlementState,
} from '@/lib/billing/iap';
import { setPremiumOnboardingGate } from '@/lib/billing/premium-onboarding';
import { useOrbit } from '@/store/orbit-store';

export default function PremiumScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const fromOnboarding = params.source === 'onboarding' || !params.source;
  const variant = fromOnboarding ? 'onboarding' : 'settings';
  const { household } = useOrbit();
  const members = household.members;

  const [busy, setBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usageSummary, setUsageSummary] = useState(() =>
    summarizeAiUsage([], members.map((m) => ({ id: m.id, name: m.name })))
  );

  useEffect(() => {
    void fetchEntitlement().then(setEntitlement);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const events = await loadAiUsageEvents(household?.id);
      if (cancelled) return;
      setUsageSummary(
        summarizeAiUsage(
          events,
          members.map((m) => ({ id: m.id, name: m.name }))
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [household?.id, members]);

  const usagePanel = useMemo(() => {
    if (!entitlement || !isPremiumActive(entitlement)) return null;
    return {
      tokensUsedThisPeriod: usageSummary.tokensUsedThisPeriod,
      tokensPerMonth: TOKENS_PER_MONTH,
      periodResetsAt: usageSummary.periodResetsAt,
      topUpBalance: usageSummary.topUpBalance,
    };
  }, [entitlement, usageSummary]);

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

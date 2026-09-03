/**
 * Premium route — post-email-confirm onboarding soft gate + Settings entry.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { PremiumPaywall } from '@/components/orbit/premium-paywall';
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

export default function PremiumScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const fromOnboarding = params.source === 'onboarding' || !params.source;
  const variant = fromOnboarding ? 'onboarding' : 'settings';

  const [busy, setBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchEntitlement().then(setEntitlement);
  }, []);

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

  const startTrial = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const next = await purchasePremium('monthly');
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
      onStartTrial={() => void startTrial()}
      onRestore={() => void restore()}
      onContinue={() => void leave('started')}
      onDismiss={() => void leave(fromOnboarding ? 'deferred' : 'skipped')}
    />
  );
}

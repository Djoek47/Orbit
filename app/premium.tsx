/**
 * Premium route — post-email-confirm onboarding soft gate + Settings entry.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PremiumPaywall } from '@/components/orbit/premium-paywall';
import { TokenTopUpPicker } from '@/components/orbit/token-top-up-picker';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { space } from '@/constants/orbit-theme';
import { summarizeActUsage } from '@/lib/ai/act-events';
import { loadActEvents } from '@/lib/ai/act-ledger';
import { IAP_SUBSCRIPTIONS } from '@/constants/billing';
import {
  fetchEntitlement,
  isPremiumActive,
  fetchStorePrices,
  isTrialEligible,
  isUserCancelledPurchase,
  premiumCopy,
  purchasePremium,
  purchaseTokens,
  restorePurchases,
  type EntitlementState,
  type IapTokenPackKey,
  type StorePrice,
} from '@/lib/billing/iap';
import { AccountEscapeSheet } from '@/components/orbit/billing/account-escape-sheet';
import { SubscriptionDashboard } from '@/components/orbit/billing/subscription-dashboard';
import { PREMIUM_ALLOWANCE_COPY } from '@/constants/billing';
import { openManageSubscriptions } from '@/lib/billing/manage-subscriptions';
import { paywallCopy } from '@/lib/billing/subscription-status';
import { useSubscription } from '@/lib/billing/use-subscription';
import { useAccess } from '@/lib/billing/access-provider';
import { setPremiumOnboardingGate } from '@/lib/billing/premium-onboarding';
import { sendSubscriptionReceiptEmail } from '@/lib/billing/send-subscription-receipt';
import { loadTokenGrants, topUpBalanceFromGrants } from '@/lib/billing/token-grants';
import { formatPrice } from '@/lib/billing/topup-receipt';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { isSignOutInFlight, signOutAndLeave } from '@/lib/auth/sign-out-and-leave';
import { useOrbit } from '@/store/orbit-store';

function formatRenewalDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PremiumScreen() {
  const params = useLocalSearchParams<{ source?: string; mode?: string }>();
  /** The paywall is the gate itself: the household has no active trial or subscription. */
  const gated = params.mode === 'locked';
  const fromOnboarding = !gated && (params.source === 'onboarding' || !params.source);
  const variant = fromOnboarding ? 'onboarding' : 'settings';
  // After sign-up and once the gate is shut there is no "Not now" — only Settings may close it.
  const dismissible = !gated && !fromOnboarding;
  const insets = useSafeAreaInsets();
  const { household, orbitPalette, accentTheme, currentMember, currentUser, signOut, refreshHousehold } = useOrbit();
  const access = useAccess();
  const sub = useSubscription(household.premium, currentUser?.trialUsedAt);
  // Our no-payment trial could not start (used up, or the server refused): never leave a dead
  // button. The page falls back to a normal Apple subscription right away.
  const [appTrialUnavailable, setAppTrialUnavailable] = useState(false);
  const appTrial = sub.appTrial && !appTrialUnavailable;
  const [accountOpen, setAccountOpen] = useState(false);
  const [eligible, setEligible] = useState<Partial<Record<'monthly' | 'yearly', boolean>>>({});
  const [storePrices, setStorePrices] = useState<Record<string, StorePrice>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      isTrialEligible('monthly').catch(() => true),
      isTrialEligible('yearly').catch(() => true),
    ]).then(
      ([monthly, yearly]) => {
        if (!cancelled) setEligible({ monthly, yearly });
      }
    );
    void fetchStorePrices().then((prices) => {
      if (!cancelled) setStorePrices(prices);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A non-dismissible paywall must step aside by itself when the household is already
  // covered — a second admin on a new phone, or a partner who paid on their own Apple ID.
  // Without this they would face a paywall with no way past it for a house that has paid.
  const stepAsideRef = useRef(false);
  useEffect(() => {
    if (dismissible || stepAsideRef.current || isSignOutInFlight()) return;
    if (!access.ready || access.view.appLocked) return;
    stepAsideRef.current = true;
    void (async () => {
      await setPremiumOnboardingGate('started');
      if (gated) router.replace('/(tabs)' as never);
      else if (fromOnboarding) router.replace('/welcome' as never);
    })();
  }, [access.ready, access.view.appLocked, dismissible, fromOnboarding, gated]);

  // A trial that has run out reads differently from a first visit: say what happened. And in
  // a two-parent house the one who did not pay may land here before the one who did has opened
  // this version — name them, so this reads as "ask Nero" rather than "pay again".

  // The mode's own headline says "trial ended" or "welcome back"; the only extra line is for a
  // house that has never recorded a subscription but has a second admin who may be paying.
  // The owner asked for no extra line here; the mode's own headline carries the message.
  const notice: string | null = appTrial
    ? 'This Apple ID already used its free trial. You get one more with this account; after that, all free trials for this Apple ID are used.'
    : sub.appleTrialsUsed
      ? 'All free trials for this Apple ID have been used.'
      : null;
  // From Poppins during a trial: sell the subscription, which is what brings the 300 a month.
  const upgradeFromTrial = params.source === 'poppins' && access.view.level === 'trial';
  const copy = upgradeFromTrial
    ? {
        kicker: 'Included with your subscription',
        title: 'Meet Poppin AI',
        body: 'Talk to your house. Tokens refill every month.',
        cta: 'Subscribe',
        offersTrial: false,
      }
    : sub.ready
    ? paywallCopy(sub.mode, {
        firstName: (currentMember?.name ?? currentUser?.name ?? '').trim().split(/\s+/)[0],
        lastEndedAt: sub.lastEndedAt,
        allowanceLine: PREMIUM_ALLOWANCE_COPY,
      })
    : null;
  const { c } = useOrbitColors();
  const members = household.members;

  const [busy, setBusy] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpBalance, setTopUpBalance] = useState(0);
  const [usageSummary, setUsageSummary] = useState(() =>
    summarizeActUsage(
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
      const events = await loadActEvents(household?.id);
      const grants = await loadTokenGrants(household?.id);
      if (cancelled) return;
      const balance = topUpBalanceFromGrants(grants);
      setTopUpBalance(balance);
      setUsageSummary(
        summarizeActUsage(
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
    const events = await loadActEvents(household.id);
    const grants = await loadTokenGrants(household.id);
    const balance = topUpBalanceFromGrants(grants);
    setTopUpBalance(balance);
    setUsageSummary(
      summarizeActUsage(
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
      setStatusMessage(`Added ${grant.tokens} tokens`);
      setShowTopUp(false);
      await refreshUsage();
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        setErrorMessage(null);
      } else {
        const { formatUnknownError } = await import('@/lib/errors/unknown-error');
        const { friendlyErrorMessage } = await import('@/lib/errors/friendly-error');
        const { recordAppError } = await import('@/lib/errors/error-log');
        const raw = formatUnknownError(error, 'Could not buy more tokens.');
        void recordAppError({
          title: "That didn't go through",
          message: raw,
          source: 'premium-topup',
          category: 'billing',
        });
        setErrorMessage(friendlyErrorMessage(raw));
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
    // Re-read StoreKit so the gate in the tabs sees the new state before we land there.
    await access.refresh();
    if (gated) {
      router.replace('/(tabs)' as never);
      return;
    }
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
    // This Apple ID already has this plan (often its free trial): Apple will not sell it again
    // and will not end the trial early. Say so instead of showing "Trial started" a second time.
    const held = access.deviceEntitlement;
    if (held?.active && held.productId === IAP_SUBSCRIPTIONS[product].productId) {
      setErrorMessage(
        held.inTrial
          ? `You're already on the ${product} plan's free trial. It turns into your subscription on its own${
              held.expiresAt ? ` on ${formatRenewalDate(held.expiresAt)}` : ''
            }.`
          : `You already have the ${product} plan.`
      );
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    // This Apple ID already had Apple's trial, but this account never had one: ours, no payment.
    if (appTrial && household?.id) {
      const { startAppTrial } = await import('@/lib/billing/start-app-trial');
      const result = await startAppTrial(household.id, sub.appleKey);
      if (result.ok) {
        await refreshHousehold().catch(() => undefined);
        await access.refresh();
        void sub.refresh();
        Alert.alert(
          'Your free trial has started',
          `Everything is open until ${formatRenewalDate(result.endsAt)}. Nothing is charged; subscribe any time to keep going after that.`
        );
        await setPremiumOnboardingGate('started');
        setBusy(false);
        await leave('started');
      } else {
        setBusy(false);
        setAppTrialUnavailable(true);
        void sub.refresh();
        setErrorMessage(
          result.reason === 'apple_trials_used'
            ? 'All free trials for this Apple ID have been used. Subscribe to continue.'
            : result.reason === 'trial_used'
            ? 'This account already had its free trial. Subscribe to continue.'
            : result.reason === 'forbidden'
              ? 'Only the household owner or an admin can start the trial.'
              : 'The free trial could not start. You can still subscribe below.'
        );
      }
      return;
    }
    try {
      const next = await purchasePremium(product);
      setEntitlement(next);
      const catalog = IAP_SUBSCRIPTIONS[product];
      const plan = `ChoreMaxx ${catalog.label}`;
      // Apple's own price in the buyer's currency (CA$9.99 in Canada), not the built-in USD one.
      const charged = storePrices[catalog.productId]?.display ?? formatPrice(catalog.priceUsd);
      const price = catalog.period === 'year' ? `${charged}/year` : `${charged}/month`;
      void sendSubscriptionReceiptEmail({
        to: currentUser?.email || undefined,
        name: currentMember?.name ?? currentUser?.name ?? undefined,
        plan,
        price,
        renewalDate: formatRenewalDate(next.expiresAt),
        inTrial: next.inTrial,
        mock: next.source === 'mock',
        householdId: household?.id ?? undefined,
      }).then((mailed) => {
        const started = next.inTrial ? 'Trial started' : 'Subscription active';
        if (mailed.ok) {
          setStatusMessage(`${started} · emailed ${mailed.to}`);
        } else {
          setStatusMessage(started);
        }
      });
      setStatusMessage(next.inTrial ? 'Trial started' : 'Subscription active');
      const inbox = currentUser?.email ? ` to ${currentUser.email}` : '';
      Alert.alert(
        next.inTrial ? 'Your free trial has started' : 'You’re subscribed',
        next.inTrial
          ? `Welcome to ${plan}. Nothing is charged until ${formatRenewalDate(next.expiresAt)}, and you can cancel any time in your Apple subscriptions. A confirmation email is on its way${inbox}.`
          : `${plan} is active, ${price}. A confirmation email is on its way${inbox}.`
      );
      void sub.refresh();
      await setPremiumOnboardingGate('started');
      await new Promise((r) => setTimeout(r, 700));
      await leave('started');
    } catch (error) {
      if (isUserCancelledPurchase(error)) {
        setErrorMessage(null);
      } else {
        const { formatUnknownError } = await import('@/lib/errors/unknown-error');
        const { friendlyErrorMessage } = await import('@/lib/errors/friendly-error');
        const { recordAppError } = await import('@/lib/errors/error-log');
        const raw = formatUnknownError(error, 'Could not start the trial. Try again in a moment.');
        void recordAppError({
          title: "That didn't go through",
          message: raw,
          source: 'premium-trial',
          category: 'billing',
        });
        setErrorMessage(friendlyErrorMessage(raw));
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
        // Tell a lapsed subscriber their plan ended, rather than "nothing found".
        const { fetchSubscriptionHistory } = await import('@/lib/billing/iap');
        const history = await fetchSubscriptionHistory().catch(() => []);
        const last = [...history].sort((a, b) => (b.endsAt ?? '').localeCompare(a.endsAt ?? ''))[0];
        setErrorMessage(
          last
            ? `Your subscription ended${last.endsAt ? ` on ${formatRenewalDate(last.endsAt)}` : ''}. Pick a plan to renew.`
            : 'Nothing to restore on this Apple ID.'
        );
      }
      void access.refresh();
      void sub.refresh();
    } catch (error) {
      const { formatUnknownError } = await import('@/lib/errors/unknown-error');
      const { friendlyErrorMessage } = await import('@/lib/errors/friendly-error');
      const { recordAppError } = await import('@/lib/errors/error-log');
      const raw = formatUnknownError(error, 'Restore failed. Try again.');
      void recordAppError({
        title: 'Restore failed',
        message: raw,
        source: 'premium-restore',
        category: 'billing',
      });
      setErrorMessage(friendlyErrorMessage(raw));
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

  const manage = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await openManageSubscriptions();
    } catch {
      setErrorMessage('Could not open Apple subscriptions. Open Settings → your name → Subscriptions.');
    } finally {
      // The sheet may have cancelled or changed the plan: read it all again.
      await access.refresh();
      await sub.refresh();
      setBusy(false);
    }
  };

  // Covered, and opened from Settings: the dashboard, not a sales page.
  if (
    variant === 'settings' &&
    !upgradeFromTrial &&
    access.ready &&
    !access.view.appLocked &&
    isPremiumActive(access.entitlement)
  ) {
    return (
      <SubscriptionDashboard
        entitlement={access.entitlement}
        renewal={sub.renewal}
        history={sub.history}
        storePrices={storePrices}
        busy={busy}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        deviceProductId={
          access.deviceEntitlement?.active ? access.deviceEntitlement.productId ?? null : null
        }
        onManage={() => void manage()}
        onRestore={() => void restore()}
        onSubscribe={(period) => void startTrial(period)}
      />
    );
  }

  const confirmMove = () =>
    Alert.alert(
      'Move your subscription here?',
      'Your subscription covers one household at a time. Moving it covers this household and ends cover for the other one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move it here',
          onPress: () =>
            void access.moveSubscriptionHere().then((ok) => {
              if (ok) void leave('started');
              else Alert.alert('Could not move it', 'Check your connection and try again.');
            }),
        },
      ]
    );
  const moveOffered = access.ready && access.view.appLocked && access.claimedElsewhere;
  return (
    <PremiumPaywall
      copy={copy}
      variant={variant}
      // Hold the button until the page knows which version it is — a returning subscriber must
      // never be offered a trial for the split second before "Welcome back" loads.
      busy={busy || !sub.ready}
      // Follow the same decision that locks or opens the app. The raw device entitlement said
      // "subscribed" while the gate said "locked": Continue left the paywall, the gate sent
      // you straight back, and nothing ever opened.
      alreadyPremium={
        access.ready
          ? !access.view.appLocked && isPremiumActive(access.entitlement)
          : entitlement
            ? isPremiumActive(entitlement)
            : false
      }
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      usage={usagePanel}
      // A failed renewal is fixed in Apple's payment settings, not by buying again.
      onStartTrial={(period) =>
        moveOffered ? confirmMove() : void (!upgradeFromTrial && sub.mode === 'payment-issue' ? manage() : startTrial(period))
      }
      onRestore={() => void restore()}
      onContinue={() => void leave('started')}
      onDismiss={() => void leave(fromOnboarding ? 'deferred' : 'skipped')}
      dismissible={dismissible}
      onAccount={() => setAccountOpen(true)}
      trialEligibleByPeriod={appTrial ? { monthly: true, yearly: true } : eligible}
      noCardTrial={appTrial}
      storePrices={storePrices}
      notice={notice}
      footerSlot={
        <AccountEscapeSheet
          visible={accountOpen}
          onClose={() => setAccountOpen(false)}
          onRestore={() => void restore()}
          onSignOut={() => void signOutAndLeave(signOut)}
          isOwner={currentMember?.role === 'owner'}
        />
      }
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

/**
 * Everything a subscription screen needs to decide what to show, read once.
 *
 *   past      has this household had a trial / paid before (history + the household row)
 *   mode      which paywall: trial, trial-ended, renew or subscribe
 *   renewal   Apple's auto-renew status and next charge date
 *   history   every period, newest first
 *
 * `ready` is false until the first read; screens should not pick a paywall before it is true,
 * or a returning subscriber sees "Start free trial" flash before "Welcome back".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchAppleIdKey,
  fetchRenewalState,
  fetchSubscriptionHistory,
  isTrialEligible,
  type RenewalState,
} from '@/lib/billing/iap';
import {
  billingPast,
  paywallMode,
  type HistoryEntry,
  type PaywallMode,
} from '@/lib/billing/subscription-status';
import type { HouseholdPremium } from '@/types/orbit';

export type SubscriptionInfo = {
  ready: boolean;
  history: HistoryEntry[];
  renewal: RenewalState;
  /** Apple's trial eligibility per plan. */
  eligible: { monthly?: boolean; yearly?: boolean };
  mode: PaywallMode;
  /** The trial on offer is ours (no payment): this Apple ID already used Apple's. */
  appTrial: boolean;
  /** This Apple ID has used Apple's trial and the one extra we give: no more trials. */
  appleTrialsUsed: boolean;
  /** Key for this phone's Apple ID (see fetchAppleIdKey), passed to start_app_trial. */
  appleKey: string | null;
  lastEndedAt: string | null;
  refresh: () => Promise<void>;
};

const NO_RENEWAL: RenewalState = {
  willRenew: null,
  renewalDate: null,
  pendingProductId: null,
  billingIssue: false,
  graceEndsAt: null,
};

export function useSubscription(
  householdPremium: HouseholdPremium | null | undefined,
  /** profiles.trial_used_at for the signed-in person. */
  userTrialUsedAt?: string | null
): SubscriptionInfo {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [renewal, setRenewal] = useState<RenewalState>(NO_RENEWAL);
  const [eligible, setEligible] = useState<{ monthly?: boolean; yearly?: boolean }>({});
  const [appleKey, setAppleKey] = useState<string | null>(null);
  const [appleTrialsUsed, setAppleTrialsUsed] = useState(false);

  const refresh = useCallback(async () => {
    const [h, r, monthly, yearly] = await Promise.all([
      fetchSubscriptionHistory().catch(() => [] as HistoryEntry[]),
      fetchRenewalState().catch(() => NO_RENEWAL),
      isTrialEligible('monthly').catch(() => true),
      isTrialEligible('yearly').catch(() => true),
    ]);
    // Apple says this Apple ID used its trial: has it also used the one extra we give?
    let key: string | null = null;
    let used = false;
    if (monthly === false && yearly === false) {
      key = await fetchAppleIdKey();
      if (key) {
        const { appTrialUsedFor } = await import('@/lib/billing/start-app-trial');
        used = await appTrialUsedFor(key);
      }
    }
    setHistory(h);
    setRenewal(r);
    setEligible({ monthly, yearly });
    setAppleKey(key);
    setAppleTrialsUsed(used);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const past = useMemo(
    () => billingPast({ history, householdPremium, userTrialUsedAt }),
    [history, householdPremium, userTrialUsedAt]
  );
  // Both plans share one subscription group, so one trial covers both: eligible for either
  // means eligible. Unknown counts as eligible — Apple's purchase sheet is the final word.
  const appleTrialEligible =
    eligible.monthly === undefined && eligible.yearly === undefined
      ? undefined
      : Boolean(eligible.monthly || eligible.yearly);
  const rawMode = paywallMode({ appleTrialEligible, past, billingIssue: renewal.billingIssue });
  const mode: PaywallMode = rawMode === 'trial' && appleTrialEligible === false && appleTrialsUsed ? 'subscribe' : rawMode;

  const appTrial = mode === 'trial' && appleTrialEligible === false;
  return { ready, history, renewal, eligible, mode, appTrial, appleTrialsUsed: appleTrialsUsed && rawMode === 'trial', appleKey, lastEndedAt: past.lastEndedAt, refresh };
}

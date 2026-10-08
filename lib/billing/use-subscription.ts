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

export function useSubscription(householdPremium: HouseholdPremium | null | undefined): SubscriptionInfo {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [renewal, setRenewal] = useState<RenewalState>(NO_RENEWAL);
  const [eligible, setEligible] = useState<{ monthly?: boolean; yearly?: boolean }>({});

  const refresh = useCallback(async () => {
    const [h, r, monthly, yearly] = await Promise.all([
      fetchSubscriptionHistory().catch(() => [] as HistoryEntry[]),
      fetchRenewalState().catch(() => NO_RENEWAL),
      isTrialEligible('monthly').catch(() => true),
      isTrialEligible('yearly').catch(() => true),
    ]);
    setHistory(h);
    setRenewal(r);
    setEligible({ monthly, yearly });
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const past = useMemo(() => billingPast({ history, householdPremium }), [history, householdPremium]);
  // Both plans share one subscription group, so one trial covers both: eligible for either
  // means eligible. Unknown counts as eligible — Apple's purchase sheet is the final word.
  const appleTrialEligible =
    eligible.monthly === undefined && eligible.yearly === undefined
      ? undefined
      : Boolean(eligible.monthly || eligible.yearly);
  const mode = paywallMode({ appleTrialEligible, past });

  return { ready, history, renewal, eligible, mode, lastEndedAt: past.lastEndedAt, refresh };
}

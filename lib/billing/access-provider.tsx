/**
 * The household's access level, computed once and shared by every screen.
 *
 * Merges what this phone's StoreKit says with what the household row says (see
 * household-entitlement), turns that into paid / trial / locked (see access-gate), and does
 * the two side effects that follow from it:
 *
 *   - sets the monthly Poppins allowance, so a trial household runs on bought credits only
 *   - on an admin's phone with an active subscription, reports it to the household so the
 *     Sidekick phones and shared tablet unlock too
 *
 * `ready` stays false until the first StoreKit read finishes. Nothing gates on an unknown
 * state: a paying household must never see the paywall flash on launch while StoreKit loads.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { isSupabaseMode } from '@/config/data-mode';
import { EMPTY_ENTITLEMENT, type EntitlementState } from '@/constants/billing';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { accessView, type AccessView } from '@/lib/billing/access-gate';
import { setCurrentMonthlyAllowance } from '@/lib/billing/allowance-state';
import { effectiveEntitlement, householdPremiumKnown } from '@/lib/billing/household-entitlement';
import {
  fetchEntitlement,
  isNativeIapAvailable,
  latestStoreKitPurchase,
  syncHouseholdEntitlement,
} from '@/lib/billing/iap';
import { useOrbit } from '@/store/orbit-store';

type AccessContextValue = {
  /** False until the first entitlement read completes. Never gate before this is true. */
  ready: boolean;
  view: AccessView;
  entitlement: EntitlementState;
  /** True for owner/admin — the only people who may ever see a purchase screen. */
  canPurchase: boolean;
  /** Re-read StoreKit — call after a purchase or restore. */
  refresh: () => Promise<void>;
  /** What this phone's own Apple ID holds, before the household is merged in. */
  deviceEntitlement: EntitlementState | null;
};

const PAID_DEFAULT = accessView(
  { ...EMPTY_ENTITLEMENT, active: true, source: 'mock' },
  TOKENS_PER_MONTH
);

const AccessContext = createContext<AccessContextValue>({
  ready: false,
  view: PAID_DEFAULT,
  entitlement: EMPTY_ENTITLEMENT,
  canPurchase: false,
  refresh: async () => {},
  deviceEntitlement: null,
});

/** How often to re-check while the app sits open — a trial can end mid-session. */
const RECHECK_MS = 5 * 60 * 1000;

/**
 * The gate only runs where money is real. In mock data mode (Expo Go, Cursor's cloud runs,
 * the tour's demo household) there is no StoreKit and no household row, and gating there
 * would lock every developer and every demo out behind a paywall that cannot be paid.
 * EXPO_PUBLIC_PAYMENT_GATE=force turns it on anyway, to test the gate itself.
 */
const GATE_ENABLED = isSupabaseMode || process.env.EXPO_PUBLIC_PAYMENT_GATE === 'force';

export function AccessProvider({ children }: { children: ReactNode }) {
  const { household, currentMember, currentUser, isSignedIn } = useOrbit();
  const [local, setLocal] = useState<EntitlementState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const syncedRef = useRef<string | null>(null);
  /**
   * Set when the server says this Apple ID's subscription already pays for another household.
   * StoreKit's entitlement belongs to the Apple ID, not the ChoreMaxx account, so without this
   * any account signed in on a subscriber's phone — another family's, or a second household
   * the same person made — would unlock for free.
   */
  const [claimedElsewhere, setClaimedElsewhere] = useState(false);

  // A different person signed in: forget the last one's entitlement before anything reads it.
  const userId = currentUser?.id ?? null;
  const lastUserRef = useRef<string | null>(userId);
  useEffect(() => {
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;
    setLocal(null);
    setClaimedElsewhere(false);
    syncedRef.current = null;
  }, [userId]);

  const canPurchase = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const refresh = useCallback(async () => {
    try {
      const next = await fetchEntitlement();
      setLocal(next);
    } catch (error) {
      console.warn('AccessProvider.refresh', error);
      setLocal((prev) => prev ?? EMPTY_ENTITLEMENT);
    }
    setNow(new Date());
  }, []);

  // First read, and again whenever the app comes back.
  useEffect(() => {
    if (!isSignedIn) return;
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const timer = setInterval(() => setNow(new Date()), RECHECK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [isSignedIn, refresh]);

  const entitlement = useMemo(
    () => effectiveEntitlement(claimedElsewhere ? null : local, household.premium, now),
    [claimedElsewhere, local, household.premium, now]
  );

  const view = useMemo(() => {
    if (!GATE_ENABLED) return PAID_DEFAULT;
    // A device that cannot buy — a Sidekick's phone, a shared tablet — is only ever locked by
    // a period the household actually recorded and that has actually ended. "Never told"
    // (a server without the migration, or an admin who has not opened the new build yet) is
    // not "ended": locking every child in a paying house on that evidence is the wrong failure.
    if (!canPurchase && !householdPremiumKnown(household.premium)) return PAID_DEFAULT;
    return accessView(entitlement, TOKENS_PER_MONTH, now);
  }, [canPurchase, entitlement, household.premium, now]);
  const ready = !GATE_ENABLED || local !== null;

  // The allowance follows the access level. Only once known — before that, keep the paid
  // default so a paying household never sees "0 actions" flash on launch.
  useEffect(() => {
    if (!ready) return;
    setCurrentMonthlyAllowance(view.monthlyAllowance);
  }, [ready, view.monthlyAllowance]);

  // Tell the household. Only from an admin's phone, only when this Apple ID actually holds an
  // active subscription, and once per distinct period so a relaunch does not re-post it.
  useEffect(() => {
    if (!canPurchase || !household.id || !isNativeIapAvailable()) return;
    if (!local?.active) return;
    const purchase = latestStoreKitPurchase();
    if (!purchase) return;
    const householdId = household.id;
    void (async () => {
      // Turning renewal off has to reach the household too, or the children's devices keep
      // the long renewing grace after a cancellation.
      const { fetchRenewalState } = await import('@/lib/billing/iap');
      const renewal = await fetchRenewalState().catch(() => null);
      const withRenewal =
        renewal && renewal.willRenew !== null
          ? { ...purchase, renewalInfoIOS: { ...(purchase.renewalInfoIOS as object | null), willAutoRenew: renewal.willRenew } }
          : purchase;
      const key = `${householdId}:${String(purchase.originalTransactionIdentifierIOS ?? purchase.id)}:${String(purchase.expirationDateIOS ?? '')}:${String(renewal?.willRenew)}`;
      if (syncedRef.current === key) return;
      syncedRef.current = key;
      const result = await syncHouseholdEntitlement(householdId, withRenewal);
      setClaimedElsewhere(result === 'claimed-elsewhere');
    })();
  }, [canPurchase, household.id, local]);

  // The day-before reminder, and a "trial has ended" if renewal was turned off. Rescheduled
  // whenever the trial's end or renewal changes; cleared once it is no longer a trial.
  const reminderKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!GATE_ENABLED || !canPurchase || !local) return;
    void (async () => {
      const { fetchRenewalState } = await import('@/lib/billing/iap');
      const { scheduleTrialReminders, trialReminderPlan } = await import('@/lib/billing/trial-reminder');
      const { IAP_SUBSCRIPTIONS } = await import('@/constants/billing');
      const renewal = local.inTrial ? await fetchRenewalState() : { willRenew: null };
      const key = `${local.inTrial}:${local.expiresAt}:${renewal.willRenew}`;
      if (reminderKeyRef.current === key) return;
      reminderKeyRef.current = key;
      const yearly = local.productId === IAP_SUBSCRIPTIONS.yearly.productId;
      const catalog = yearly ? IAP_SUBSCRIPTIONS.yearly : IAP_SUBSCRIPTIONS.monthly;
      await scheduleTrialReminders(
        trialReminderPlan({
          inTrial: local.inTrial && local.active,
          endsAt: local.expiresAt,
          willRenew: renewal.willRenew,
          priceLine: `$${catalog.priceUsd}/${yearly ? 'year' : 'month'}`,
        })
      );
    })();
  }, [canPurchase, local]);

  const value = useMemo(
    () => ({ ready, view, entitlement, canPurchase, refresh, deviceEntitlement: local }),
    [ready, view, entitlement, canPurchase, refresh, local]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  return useContext(AccessContext);
}

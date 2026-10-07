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

import { EMPTY_ENTITLEMENT, type EntitlementState } from '@/constants/billing';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import { accessView, type AccessView } from '@/lib/billing/access-gate';
import { setCurrentMonthlyAllowance } from '@/lib/billing/allowance-state';
import { effectiveEntitlement } from '@/lib/billing/household-entitlement';
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
});

/** How often to re-check while the app sits open — a trial can end mid-session. */
const RECHECK_MS = 5 * 60 * 1000;

export function AccessProvider({ children }: { children: ReactNode }) {
  const { household, currentMember, isSignedIn } = useOrbit();
  const [local, setLocal] = useState<EntitlementState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const syncedRef = useRef<string | null>(null);

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
    () => effectiveEntitlement(local, household.premium, now),
    [local, household.premium, now]
  );

  const view = useMemo(() => accessView(entitlement, TOKENS_PER_MONTH, now), [entitlement, now]);
  const ready = local !== null;

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
    const key = `${household.id}:${String(purchase.originalTransactionIdentifierIOS ?? purchase.id)}:${String(purchase.expirationDateIOS ?? '')}`;
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    void syncHouseholdEntitlement(household.id, purchase);
  }, [canPurchase, household.id, local]);

  const value = useMemo(
    () => ({ ready, view, entitlement, canPurchase, refresh }),
    [ready, view, entitlement, canPurchase, refresh]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  return useContext(AccessContext);
}

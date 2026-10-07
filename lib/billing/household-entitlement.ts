/**
 * One answer to "has this household paid", from two sources that each know half of it.
 *
 *   the device   StoreKit, via fetchEntitlement — authoritative, but only on the phone whose
 *                Apple ID bought the subscription
 *   the house    the household row, via sync-entitlement — reaches every device in the house,
 *                but only knows what an admin device last reported
 *
 * The purchasing phone trusts itself. Every other phone — the Sidekick's, the shared tablet —
 * has only the household, and gets a short grace period on it, because a renewal Apple has
 * already charged for only reaches the row when an admin next opens the app. Locking a paying
 * family's children out for a weekend because a parent did not open ChoreMaxx would be the
 * wrong failure; two free days after a real cancellation is the cheap one.
 *
 * Pure: no React Native, no storage, no clock of its own.
 */
import {
  EMPTY_ENTITLEMENT,
  isPremiumActive,
  type EntitlementState,
  type IapProductId,
} from '@/constants/billing';
import type { HouseholdPremium } from '@/types/orbit';

/**
 * How long past its recorded expiry the household's Premium still counts on other devices.
 *
 * Two lengths, chosen by what Apple said about renewal when the row was last written:
 *
 *   will renew   16 days — Apple's own billing grace period. A renewal Apple has already
 *                charged only reaches this row when an admin next opens the app; until App
 *                Store Server Notifications write it directly, a family whose parent does not
 *                open ChoreMaxx for a week must not find their children locked out.
 *   cancelled    48 hours — the admin turned renewal off, so the end is real.
 *
 * Unknown (rows written before this field existed) is treated as renewing: of the two ways to
 * be wrong, locking out a family that paid is the one that costs a customer.
 */
export const HOUSEHOLD_PREMIUM_GRACE_MS = 48 * 60 * 60 * 1000;
export const HOUSEHOLD_PREMIUM_RENEWING_GRACE_MS = 16 * 24 * 60 * 60 * 1000;

/** True once the household has ever recorded a subscription period. */
export function householdPremiumKnown(premium: HouseholdPremium | null | undefined): boolean {
  return Boolean(premium?.expiresAt);
}

/**
 * The household row as an entitlement, with the grace period applied.
 *
 * Null when the household has never recorded a subscription — which is different from an
 * expired one only in that there is nothing to show in Settings.
 */
export function entitlementFromHousehold(
  premium: HouseholdPremium | null | undefined,
  now = new Date()
): EntitlementState | null {
  if (!premium?.expiresAt) return null;
  const expires = new Date(premium.expiresAt).getTime();
  if (Number.isNaN(expires)) return null;
  const grace =
    premium.willRenew === false ? HOUSEHOLD_PREMIUM_GRACE_MS : HOUSEHOLD_PREMIUM_RENEWING_GRACE_MS;
  const graced = new Date(expires + grace);
  return {
    active: graced.getTime() > now.getTime(),
    productId: (premium.productId ?? null) as IapProductId | null,
    effectiveAt: null,
    expiresAt: graced.toISOString(),
    source: 'storekit',
    inTrial: premium.inTrial,
  };
}

/** paid beats trial beats nothing. */
function rank(state: EntitlementState | null | undefined, now: Date): number {
  if (!state || !isPremiumActive(state, now)) return 0;
  return state.inTrial ? 1 : 2;
}

/**
 * Whichever source grants more, and within the same tier whichever runs longer.
 *
 * Paid on either side wins over a trial on the other: an admin who converted on their phone
 * should not see the household row's stale "trial" lock Poppins again.
 */
export function effectiveEntitlement(
  local: EntitlementState | null | undefined,
  household: HouseholdPremium | null | undefined,
  now = new Date()
): EntitlementState {
  const fromHouse = entitlementFromHousehold(household, now);
  const a = rank(local, now);
  const b = rank(fromHouse, now);
  if (a === 0 && b === 0) return local ?? fromHouse ?? EMPTY_ENTITLEMENT;
  if (a !== b) return (a > b ? local : fromHouse) as EntitlementState;
  const aEnd = local?.expiresAt ? new Date(local.expiresAt).getTime() : Infinity;
  const bEnd = fromHouse?.expiresAt ? new Date(fromHouse.expiresAt).getTime() : Infinity;
  return (aEnd >= bEnd ? local : fromHouse) as EntitlementState;
}

// ── Reading StoreKit's own answer about the trial ────────────────────────────

type OfferLike = { type?: unknown; paymentMode?: unknown } | null | undefined;

/** "free-trial", "FreeTrial", "FREE_TRIAL" → "freetrial". expo-iap has used all three. */
function squash(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * True when this transaction is the free-trial part of an introductory offer.
 *
 * The app used to decide this itself — every purchase was marked a trial, and every refresh
 * marked the same subscription not a trial — so a household that paid straight away had
 * Poppins locked for a week, and one in its trial had it unlocked after the first relaunch.
 * StoreKit knows; this asks it.
 */
export function isFreeTrialOffer(offer: OfferLike): boolean {
  if (!offer) return false;
  return squash(offer.type) === 'introductory' && squash(offer.paymentMode) === 'freetrial';
}

/** The fields sync-entitlement needs, pulled out of a StoreKit purchase however it is shaped. */
export function syncPayloadFromPurchase(
  purchase: Record<string, unknown>,
  householdId: string
): {
  householdId: string;
  productId: string;
  originalTransactionId: string;
  expiresAtMs: number;
  inTrial: boolean;
  environment: string | null;
  willRenew: boolean | null;
} | null {
  const productId = String(purchase.productId ?? purchase.currentPlanId ?? '');
  const original = String(
    purchase.originalTransactionIdentifierIOS ?? purchase.originalTransactionId ?? purchase.id ?? ''
  ).trim();
  const rawExpiry = purchase.expirationDateIOS;
  const expiresAtMs =
    typeof rawExpiry === 'number'
      ? rawExpiry
      : typeof rawExpiry === 'string'
        ? new Date(rawExpiry).getTime()
        : NaN;
  if (!productId || !original || !Number.isFinite(expiresAtMs)) return null;
  const env = purchase.environmentIOS;
  const renewal = purchase.renewalInfoIOS as { willAutoRenew?: unknown } | null | undefined;
  return {
    householdId,
    productId,
    originalTransactionId: original,
    expiresAtMs,
    inTrial: isFreeTrialOffer(purchase.offerIOS as OfferLike),
    environment: typeof env === 'string' ? env : null,
    willRenew: typeof renewal?.willAutoRenew === 'boolean' ? renewal.willAutoRenew : null,
  };
}

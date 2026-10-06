/**
 * Human-readable subscription period dates for Settings → My Subscription.
 */
import {
  BILLING_TRIAL_DAYS,
  IAP_SUBSCRIPTIONS,
  isPremiumActive,
  type EntitlementState,
} from '@/constants/billing';

/** Settings row when there is no active subscription yet. */
export function subscriptionPricingSubtitle(): string {
  const m = IAP_SUBSCRIPTIONS.monthly.priceUsd.toFixed(2);
  const y = IAP_SUBSCRIPTIONS.yearly.priceUsd.toFixed(2);
  return `$${m}/mo · $${y}/yr (${IAP_SUBSCRIPTIONS.yearly.savingsLabel})`;
}

/** Short local date for Settings rows (e.g. Oct 6, 2026). */
export function formatSubscriptionDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Prefer stored effectiveAt; otherwise derive from expiresAt + plan length
 * so older persisted entitlements still show a start date.
 */
export function resolveEffectiveAt(state: EntitlementState, now = new Date()): string | null {
  if (state.effectiveAt) return state.effectiveAt;
  if (!state.active || !state.expiresAt) return null;
  const expires = new Date(state.expiresAt);
  if (Number.isNaN(expires.getTime())) return null;

  const start = new Date(expires);
  if (state.inTrial) {
    start.setDate(start.getDate() - BILLING_TRIAL_DAYS);
  } else if (state.productId === IAP_SUBSCRIPTIONS.yearly.productId) {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    start.setMonth(start.getMonth() - 1);
  }

  if (start.getTime() > now.getTime()) return now.toISOString();
  return start.toISOString();
}

/** One-line subtitle for the Settings list row. */
export function subscriptionDatesSubtitle(state: EntitlementState | null): string {
  if (!state || !isPremiumActive(state)) return subscriptionPricingSubtitle();
  const effective = formatSubscriptionDate(resolveEffectiveAt(state));
  const expires = formatSubscriptionDate(state.expiresAt);
  return `Effective ${effective} · Expires ${expires}`;
}

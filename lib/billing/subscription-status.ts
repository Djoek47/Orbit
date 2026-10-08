/**
 * Which subscription screen a household should see, and what it says.
 *
 * There is one paywall, but four people stand in front of it:
 *
 *   trial         never had a trial, and Apple says this Apple ID still can   → Start free trial
 *   trial-ended   had the trial, never paid (cancelled before day 8)          → Subscribe to continue
 *   renew         paid before, and it lapsed                                  → Welcome back · Renew
 *   subscribe     no trial on offer and nothing on record (the Apple ID used
 *                 its trial in another household, or the offer is not set up) → Subscribe
 *
 * The free-trial button appears only in the first. Apple decides eligibility, but Apple is
 * asked from the phone in hand; the household's own record ("this house already had its
 * trial") is the second check, so a trial is never promised twice to the same house.
 *
 * And once a household is covered, the same route shows the dashboard instead: what plan,
 * how many days remain, whether it renews, and the way to Apple's cancel screen.
 *
 * Pure: no React Native, no storage, no clock of its own.
 */
import { BILLING_TRIAL_DAYS, IAP_SUBSCRIPTIONS, type EntitlementState } from '@/constants/billing';
import type { HouseholdPremium } from '@/types/orbit';

export type PaywallMode = 'trial' | 'trial-ended' | 'renew' | 'subscribe';

/** What is known about the household's past, from every source that remembers any of it. */
export type BillingPast = {
  /** A free-trial period has been seen for this household or this Apple ID. */
  usedTrial: boolean;
  /** A paid period has been seen. */
  everPaid: boolean;
  /** When the last period ended, if one did. ISO. */
  lastEndedAt: string | null;
};

export type HistoryEntry = {
  /** Stable key: the StoreKit transaction id, or a synthetic one for periods we only inferred. */
  id: string;
  productId: string | null;
  /** ISO. When this period started (the charge date, for a paid one). */
  startedAt: string;
  /** ISO. When it ends or ended. */
  endsAt: string | null;
  kind: 'trial' | 'paid';
};

const DAY_MS = 86_400_000;

/**
 * What the household has had. Only the household row decides "trial ended" and "welcome back":
 * this phone's history belongs to the Apple ID, which may have paid for a different house, and
 * a new house must not inherit that. Apple's own eligibility check covers the Apple ID side —
 * one that used its trial elsewhere is simply not offered another ('subscribe').
 * The history is kept for the end date only.
 */
export function billingPast(input: {
  history: HistoryEntry[];
  householdPremium?: HouseholdPremium | null;
}): BillingPast {
  const { householdPremium } = input;
  const recorded = Boolean(householdPremium?.expiresAt);
  const usedTrial = recorded && Boolean(householdPremium?.inTrial);
  const everPaid = recorded && !householdPremium?.inTrial;
  const ends = [householdPremium?.expiresAt ?? null]
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime())
    .filter((t) => Number.isFinite(t));
  return {
    usedTrial,
    everPaid,
    lastEndedAt: ends.length ? new Date(Math.max(...ends)).toISOString() : null,
  };
}

export function paywallMode(input: {
  /** Apple's answer for this Apple ID. Undefined while unknown — treated as eligible. */
  appleTrialEligible: boolean | undefined;
  past: BillingPast;
}): PaywallMode {
  const { past } = input;
  if (past.everPaid) return 'renew';
  if (past.usedTrial) return 'trial-ended';
  if (input.appleTrialEligible === false) return 'subscribe';
  return 'trial';
}

export type PaywallCopy = {
  kicker: string;
  title: string;
  body: string;
  /** The main button. */
  cta: string;
  /** True only when buying starts a free trial — the legal line and the pill depend on it. */
  offersTrial: boolean;
};

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function paywallCopy(
  mode: PaywallMode,
  ctx: { firstName?: string | null; lastEndedAt?: string | null; allowanceLine: string }
): PaywallCopy {
  const name = ctx.firstName?.trim();
  const ended = shortDate(ctx.lastEndedAt ?? null);
  switch (mode) {
    case 'trial':
      return {
        kicker: 'ChoreMaxx Premium',
        title: `Try it free for ${BILLING_TRIAL_DAYS} days`,
        body: `${ctx.allowanceLine} Cancel any time before the trial ends and you pay nothing.`,
        cta: 'Start free trial',
        offersTrial: true,
      };
    case 'trial-ended':
      return {
        kicker: 'Your free trial has ended',
        title: name ? `Keep going, ${name}` : 'Keep your house running',
        body: `Your chores, XP and rewards are all still here. Subscribe to open ChoreMaxx again. ${ctx.allowanceLine}`,
        cta: 'Subscribe to continue',
        offersTrial: false,
      };
    case 'renew':
      return {
        kicker: ended ? `Premium ended ${ended}` : 'Your Premium has ended',
        title: name ? `Welcome back, ${name}` : 'Welcome back',
        body: 'Everything is where you left it — tasks, streaks, rewards and history. Renew to pick up right where you stopped.',
        cta: 'Renew Premium',
        offersTrial: false,
      };
    case 'subscribe':
    default:
      return {
        kicker: 'ChoreMaxx Premium',
        title: 'Run your whole house',
        body: ctx.allowanceLine,
        cta: 'Subscribe',
        offersTrial: false,
      };
  }
}

/** The label on Settings' Premium button, so it never offers a trial the house already had. */
export function settingsPremiumButtonLabel(active: boolean, mode: PaywallMode): string {
  if (active) return 'Manage subscription';
  switch (mode) {
    case 'trial':
      return 'Start free trial';
    case 'renew':
      return 'Renew Premium';
    default:
      return 'Subscribe';
  }
}

export type SubscriptionSummary = {
  planLabel: string;
  /** "Free trial" · "Active" · "Cancelled — ends Oct 14" */
  statusLabel: string;
  tone: 'good' | 'warn' | 'neutral';
  daysLeft: number;
  /** 0..1, how much of the current period remains. */
  remaining: number;
  /** "Renews October 14" · "Ends October 14" · "First charge October 14" */
  nextLine: string;
  endsAt: string | null;
  inTrial: boolean;
  willRenew: boolean | null;
};

export function planLabelFor(productId: string | null | undefined): string {
  if (productId === IAP_SUBSCRIPTIONS.yearly.productId) return 'Premium · Yearly';
  if (productId === IAP_SUBSCRIPTIONS.monthly.productId) return 'Premium · Monthly';
  return 'Premium';
}

function periodDays(productId: string | null | undefined, inTrial: boolean): number {
  if (inTrial) return BILLING_TRIAL_DAYS;
  return productId === IAP_SUBSCRIPTIONS.yearly.productId ? 365 : 30;
}

/**
 * The dashboard's header, from the entitlement and Apple's renewal info.
 *
 * During a trial Apple charges automatically on the day it ends unless renewal was turned
 * off, so the line says exactly that: "First charge October 14". Turned off, it says when
 * access stops instead.
 */
export function subscriptionSummary(
  entitlement: EntitlementState,
  renewal: { willRenew: boolean | null; renewalDate?: string | null },
  now = new Date()
): SubscriptionSummary {
  const endsAt = renewal.renewalDate ?? entitlement.expiresAt ?? null;
  const endMs = endsAt ? new Date(endsAt).getTime() : NaN;
  const msLeft = Number.isFinite(endMs) ? Math.max(0, endMs - now.getTime()) : 0;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  const total = periodDays(entitlement.productId, entitlement.inTrial);
  const remaining = Math.max(0, Math.min(1, msLeft / (total * DAY_MS)));
  const date = shortDate(endsAt) ?? 'the end of this period';
  const cancelled = renewal.willRenew === false;

  let statusLabel: string;
  let nextLine: string;
  let tone: SubscriptionSummary['tone'];
  if (entitlement.inTrial) {
    statusLabel = cancelled ? 'Free trial · cancelled' : 'Free trial';
    nextLine = cancelled ? `Access ends ${date}` : `First charge ${date}`;
    tone = cancelled || daysLeft <= 2 ? 'warn' : 'good';
  } else {
    statusLabel = cancelled ? 'Cancelled' : 'Active';
    nextLine = cancelled ? `Ends ${date}` : `Renews ${date}`;
    tone = cancelled ? 'warn' : 'good';
  }

  return {
    planLabel: planLabelFor(entitlement.productId),
    statusLabel,
    tone,
    daysLeft,
    remaining,
    nextLine,
    endsAt,
    inTrial: entitlement.inTrial,
    willRenew: renewal.willRenew,
  };
}

/** "3 days left" · "1 day left" · "Ends today" */
export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/**
 * Turn StoreKit's transactions into a readable history, newest first. Each renewal is its own
 * transaction, so a yearly plan bought two years running shows twice, which is what a person
 * scanning "what have I paid" expects.
 */
export function historyFromTransactions(
  rows: {
    transactionId?: unknown;
    id?: unknown;
    productId?: unknown;
    transactionDate?: unknown;
    expirationDateIOS?: unknown;
    offerIOS?: unknown;
    revocationDateIOS?: unknown;
  }[]
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const row of rows) {
    const id = String(row.transactionId ?? row.id ?? '');
    const started = typeof row.transactionDate === 'number' ? row.transactionDate : NaN;
    if (!id || !Number.isFinite(started)) continue;
    if (typeof row.revocationDateIOS === 'number') continue; // refunded
    const offer = row.offerIOS as { type?: unknown; paymentMode?: unknown } | null | undefined;
    const mode = String(offer?.paymentMode ?? '').toLowerCase().replace(/[^a-z]/g, '');
    const kind: HistoryEntry['kind'] = mode === 'freetrial' ? 'trial' : 'paid';
    out.push({
      id,
      productId: typeof row.productId === 'string' ? row.productId : null,
      startedAt: new Date(started).toISOString(),
      endsAt:
        typeof row.expirationDateIOS === 'number'
          ? new Date(row.expirationDateIOS).toISOString()
          : null,
      kind,
    });
  }
  return mergeHistory([], out);
}

/**
 * Union, newest first, capped. The same period can arrive twice — once as the entitlement this
 * phone saw (a synthetic id with ':' in it) and once as StoreKit's transaction — so periods are
 * matched on what they are, and the real transaction id wins.
 */
export function mergeHistory(a: HistoryEntry[], b: HistoryEntry[], cap = 60): HistoryEntry[] {
  const byPeriod = new Map<string, HistoryEntry>();
  for (const e of [...a, ...b]) {
    const key = e.endsAt ? `${e.kind}|${e.productId}|${e.endsAt}` : `id|${e.id}`;
    const had = byPeriod.get(key);
    if (!had || (had.id.includes(':') && !e.id.includes(':'))) byPeriod.set(key, e);
  }
  return [...byPeriod.values()]
    .sort((x, y) => new Date(y.startedAt).getTime() - new Date(x.startedAt).getTime())
    .slice(0, cap);
}

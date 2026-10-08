/**
 * Which paywall a household sees, the dashboard's numbers, and the trial reminders.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { IAP_SUBSCRIPTIONS, type EntitlementState } from '@/constants/billing';
import {
  billingPast,
  daysLeftLabel,
  historyFromTransactions,
  mergeHistory,
  paywallCopy,
  paywallMode,
  settingsPremiumButtonLabel,
  subscriptionSummary,
  type HistoryEntry,
} from './subscription-status';
import { trialReminderPlan, TRIAL_ENDED_ID, TRIAL_ENDING_ID } from './trial-reminder';

const Y = IAP_SUBSCRIPTIONS.yearly.productId;
const M = IAP_SUBSCRIPTIONS.monthly.productId;
const now = new Date('2026-10-07T12:00:00Z');
const day = 86_400_000;
const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();

const trial: HistoryEntry = { id: 't', productId: Y, startedAt: iso(-20 * day), endsAt: iso(-13 * day), kind: 'trial' };
const paid: HistoryEntry = { id: 'p', productId: M, startedAt: iso(-60 * day), endsAt: iso(-30 * day), kind: 'paid' };

// ── The four pages ───────────────────────────────────────────────────────────
const fresh = billingPast({ history: [] });
assert.equal(paywallMode({ appleTrialEligible: true, past: fresh }), 'trial');
assert.equal(paywallMode({ appleTrialEligible: undefined, past: fresh }), 'trial', 'unknown = eligible');
assert.equal(paywallMode({ appleTrialEligible: false, past: fresh }), 'subscribe');

// The trial button disappears once the house has had its trial — even if Apple still says yes.
// This phone's history is the Apple ID's, not the house's: a new house is not "trial ended".
const afterTrial = billingPast({ history: [trial] });
assert.equal(paywallMode({ appleTrialEligible: true, past: afterTrial }), 'trial');
// Apple says this Apple ID already used it: no trial, but not "ended" either.
assert.equal(paywallMode({ appleTrialEligible: false, past: afterTrial }), 'subscribe');
// The household row remembers it too (another admin's phone had the trial).
const rowTrial = billingPast({
  history: [],
  householdPremium: { productId: Y, inTrial: true, expiresAt: iso(-day), environment: null, updatedAt: null, willRenew: false },
});
assert.equal(paywallMode({ appleTrialEligible: true, past: rowTrial }), 'trial-ended');

// Paid before and lapsed: welcome back.
const lapsed = billingPast({
  history: [trial, paid],
  householdPremium: { productId: M, inTrial: false, expiresAt: iso(-13 * day), environment: null, updatedAt: null, willRenew: false },
});
assert.equal(paywallMode({ appleTrialEligible: false, past: lapsed }), 'renew');
assert.equal(lapsed.lastEndedAt, iso(-13 * day));

const copyTrial = paywallCopy('trial', { allowanceLine: 'X.' });
assert.equal(copyTrial.cta, 'Start free trial');
assert.equal(copyTrial.offersTrial, true);
for (const mode of ['trial-ended', 'renew', 'subscribe'] as const) {
  const c = paywallCopy(mode, { firstName: 'Nero', allowanceLine: 'X.' });
  assert.equal(c.offersTrial, false, `${mode} never offers a trial`);
  assert.doesNotMatch(c.cta, /trial/i);
}
assert.equal(paywallCopy('renew', { firstName: 'Nero', allowanceLine: '' }).title, 'Welcome back, Nero');
assert.equal(paywallCopy('renew', { allowanceLine: '' }).cta, 'Renew my subscription');
assert.match(paywallCopy('trial-ended', { allowanceLine: '' }).kicker, /trial has ended/);

assert.equal(settingsPremiumButtonLabel(true, 'trial'), 'Manage subscription');
assert.equal(settingsPremiumButtonLabel(false, 'trial'), 'Start free trial');
assert.equal(settingsPremiumButtonLabel(false, 'trial-ended'), 'Subscribe');
assert.equal(settingsPremiumButtonLabel(false, 'renew'), 'Renew subscription');

// ── Dashboard ────────────────────────────────────────────────────────────────
const inTrial: EntitlementState = {
  active: true,
  productId: Y,
  effectiveAt: iso(-2 * day),
  expiresAt: iso(5 * day),
  source: 'storekit',
  inTrial: true,
};
const s1 = subscriptionSummary(inTrial, { willRenew: true }, now);
assert.equal(s1.daysLeft, 5);
assert.match(s1.nextLine, /^First charge /, 'Apple charges when the trial ends');
assert.equal(s1.statusLabel, 'Free trial');
assert.ok(Math.abs(s1.remaining - 5 / 7) < 0.01);

const s2 = subscriptionSummary(inTrial, { willRenew: false }, now);
assert.match(s2.nextLine, /^Access ends /);
assert.equal(s2.tone, 'warn');

const paidYear: EntitlementState = { ...inTrial, inTrial: false, expiresAt: iso(200 * day) };
assert.match(subscriptionSummary(paidYear, { willRenew: true }, now).nextLine, /^Renews /);
assert.match(subscriptionSummary(paidYear, { willRenew: false }, now).statusLabel, /Cancelled/);
assert.equal(daysLeftLabel(1), '1 day left');
assert.equal(daysLeftLabel(0), 'Ends today');

// ── History from StoreKit ────────────────────────────────────────────────────
const h = historyFromTransactions([
  { transactionId: 'a', productId: Y, transactionDate: now.getTime() - 7 * day, expirationDateIOS: now.getTime(), offerIOS: { paymentMode: 'FREE_TRIAL' } },
  { transactionId: 'b', productId: Y, transactionDate: now.getTime(), expirationDateIOS: now.getTime() + 365 * day },
  { transactionId: 'c', productId: Y, transactionDate: now.getTime() - day, revocationDateIOS: now.getTime() },
]);
assert.deepEqual(h.map((e) => [e.id, e.kind]), [['b', 'paid'], ['a', 'trial']], 'newest first, refunds dropped');
// The same period seen as an entitlement and as a transaction shows once, under Apple's id.
const synthetic: HistoryEntry = { ...h[1]!, id: `${Y}:trial:${h[1]!.endsAt}` };
assert.deepEqual(mergeHistory([synthetic], h).map((e) => e.id), ['b', 'a']);
assert.deepEqual(mergeHistory(h, [synthetic]).map((e) => e.id), ['b', 'a']);

// ── Trial reminders ──────────────────────────────────────────────────────────
const plan = trialReminderPlan({ inTrial: true, endsAt: iso(5 * day), willRenew: true, priceLine: '$49.99/year', now });
assert.deepEqual(plan.map((r) => r.id), [TRIAL_ENDING_ID], 'renewing: just the day-before');
assert.match(plan[0]!.body, /starts automatically at \$49\.99\/year/);
const cancelledPlan = trialReminderPlan({ inTrial: true, endsAt: iso(5 * day), willRenew: false, priceLine: '', now });
assert.deepEqual(cancelledPlan.map((r) => r.id), [TRIAL_ENDING_ID, TRIAL_ENDED_ID]);
assert.equal(trialReminderPlan({ inTrial: false, endsAt: iso(day), willRenew: true, priceLine: '', now }).length, 0);

// ── Wiring ───────────────────────────────────────────────────────────────────
const read = (p: string) => readFileSync(p, 'utf8');
const premium = read('app/premium.tsx');
assert.match(premium, /<SubscriptionDashboard/, 'Settings opens a dashboard when covered');
assert.match(premium, /signOutAndLeave\(signOut\)/, 'sign-out from the gate lands on Get Started');
assert.match(premium, /busy=\{busy \|\| !sub\.ready\}/);
const tabs = read('app/(tabs)/_layout.tsx');
assert.match(tabs, /signOutAndLeave\(signOut\)/);
const sheet = read('components/orbit/billing/account-escape-sheet.tsx');
assert.match(sheet, /setTimeout\(onSignOut, 280\)/, 'waits for the sheet to close');
const paywall = read('components/orbit/premium-paywall.tsx');
assert.match(paywall, /styles\.accountChip/, 'Account is its own visible button');
assert.match(paywall, /name="settings"/);
const iap = read('lib/billing/iap.ts');
assert.match(read('lib/billing/manage-subscriptions.ts'), /showManageSubscriptionsIOS/, 'cancel goes to Apple');
assert.match(iap, /not available from the App Store yet/);

console.log('subscription-status: ok');

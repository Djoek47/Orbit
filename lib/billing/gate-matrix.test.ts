/** Mode → page copy for every payment gate case. Run: npx tsx lib/billing/gate-matrix.test.ts */
import assert from 'node:assert/strict';
import { billingPast, paywallCopy, paywallMode } from './subscription-status';
import { accessView } from './access-gate';
import { effectiveEntitlement } from './household-entitlement';

const ctx = { firstName: null, lastEndedAt: '2026-09-01T00:00:00Z', allowanceLine: 'x' };
const fresh = billingPast({ history: [], householdPremium: null });
const hadTrial = billingPast({ history: [], householdPremium: { expiresAt: '2026-09-01T00:00:00Z', inTrial: true } as never });
const paid = billingPast({ history: [], householdPremium: { expiresAt: '2026-09-01T00:00:00Z', inTrial: false } as never });

const cases: [string, Parameters<typeof paywallMode>[0], string, string, string, boolean][] = [
  ['new household, eligible', { appleTrialEligible: true, past: fresh }, 'trial', 'Try it free for 7 days', 'Start free trial', true],
  ['new household, eligibility unknown', { appleTrialEligible: undefined, past: fresh }, 'trial', 'Try it free for 7 days', 'Start free trial', true],
  ['Apple ID used trial', { appleTrialEligible: false, past: fresh }, 'subscribe', 'Keep your home on track', 'Subscribe', false],
  ['household trial ended', { appleTrialEligible: true, past: hadTrial }, 'trial-ended', 'Keep your house running', 'Subscribe to continue', false],
  ['lapsed returning', { appleTrialEligible: false, past: paid }, 'renew', 'Welcome back', 'Renew my subscription', false],
  ['billing issue', { appleTrialEligible: false, past: paid, billingIssue: true }, 'payment-issue', "Apple couldn't charge your card", 'Update payment', false],
];
for (const [name, input, mode, title, cta, trial] of cases) {
  const m = paywallMode(input);
  assert.equal(m, mode, name);
  const c = paywallCopy(m, ctx);
  assert.equal(c.title, title, name);
  assert.equal(c.cta, cta, name);
  assert.equal(c.offersTrial, trial, name);
  if (!trial) assert.doesNotMatch(`${c.title} ${c.body} ${c.cta}`, /free trial|Run your whole house/i, name);
}
// Second admin, no purchase on this Apple ID, the other admin paid: the household row opens the app.
const now = new Date('2026-10-13T00:00:00Z');
const otherPaid = effectiveEntitlement(null, { expiresAt: '2026-11-13T00:00:00Z', inTrial: false, willRenew: true } as never, now);
assert.equal(accessView(otherPaid, 300, now).appLocked, false, 'second admin: no paywall');
assert.equal(accessView(otherPaid, 300, now).level, 'paid');
// Household lapsed: locked (admins → paywall; Sidekicks/shared devices → paused screen in (tabs)/_layout).
const lapsed = effectiveEntitlement(null, { expiresAt: '2026-08-01T00:00:00Z', inTrial: false, willRenew: false } as never, now);
assert.equal(accessView(lapsed, 300, now).appLocked, true, 'lapsed: locked');
console.log('gate-matrix ok');

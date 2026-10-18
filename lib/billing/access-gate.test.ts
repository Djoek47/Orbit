import assert from 'node:assert/strict';

import {
  accessLevel,
  accessView,
  formatTrialRemaining,
  poppinsLockCopy,
  settingsAllowedWhenLocked,
  UNPAID_SETTINGS_KEYS,
} from './access-gate';
import type { EntitlementState } from '../../constants/billing';

const NOW = new Date('2026-10-07T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const inHours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();

function ent(partial: Partial<EntitlementState>): EntitlementState {
  return {
    active: true,
    productId: 'app.choremaxx.household.premium.monthlyv',
    effectiveAt: NOW.toISOString(),
    expiresAt: null,
    source: 'storekit',
    inTrial: false,
    ...partial,
  } as EntitlementState;
}

// ── Levels ────────────────────────────────────────────────────────────────────
assert.equal(accessLevel(null, NOW), 'locked', 'no entitlement at all');
assert.equal(accessLevel(ent({ active: false }), NOW), 'locked');
assert.equal(accessLevel(ent({ expiresAt: inDays(-1) }), NOW), 'locked', 'expired is locked');
assert.equal(accessLevel(ent({ expiresAt: inDays(20) }), NOW), 'paid');
assert.equal(accessLevel(ent({ expiresAt: null }), NOW), 'paid', 'no end date means paid');
assert.equal(accessLevel(ent({ inTrial: true, expiresAt: inDays(5) }), NOW), 'trial');
// A trial that ran out is the same screen as never having paid — Apple charges automatically,
// so reaching here means it was cancelled or the payment failed.
assert.equal(accessLevel(ent({ inTrial: true, expiresAt: inDays(-1) }), NOW), 'locked');

// ── Paid ──────────────────────────────────────────────────────────────────────
const paid = accessView(ent({ expiresAt: inDays(30) }), 300, NOW);
assert.equal(paid.appLocked, false);
assert.equal(paid.poppinsLocked, false);
assert.equal(paid.monthlyAllowance, 300);
assert.equal(paid.trialLabel, '');

// ── Trial — the app works, Poppins does not ───────────────────────────────────
const trial = accessView(ent({ inTrial: true, expiresAt: inDays(5) }), 300, NOW);
assert.equal(trial.appLocked, false, 'chores, XP and rewards all work on trial');
assert.equal(trial.poppinsLocked, true, 'the AI is the thing being sold');
assert.equal(trial.monthlyAllowance, 0, 'a trial household starts with no allowance');
assert.equal(trial.trialDaysLeft, 5);
assert.equal(trial.trialLabel, '5 days left');
assert.equal(trial.trialEndingSoon, false);

// ── Locked ────────────────────────────────────────────────────────────────────
const locked = accessView(null, 300, NOW);
assert.equal(locked.appLocked, true);
assert.equal(locked.poppinsLocked, true);
assert.equal(locked.monthlyAllowance, 0);

// ── The countdown ─────────────────────────────────────────────────────────────
assert.equal(formatTrialRemaining(-1), 'Trial over');
assert.equal(formatTrialRemaining(0), 'Trial over');
assert.equal(formatTrialRemaining(30 * 60_000), 'Ends in under an hour');
assert.equal(formatTrialRemaining(5 * 3_600_000), 'Ends in 5 hours');
assert.equal(formatTrialRemaining(1 * 3_600_000), 'Ends in 1 hour', 'singular');
assert.equal(formatTrialRemaining(36 * 3_600_000), 'Ends tomorrow');
assert.equal(formatTrialRemaining(7 * 86_400_000), '7 days left');

const lastDay = accessView(ent({ inTrial: true, expiresAt: inHours(5) }), 300, NOW);
assert.equal(lastDay.trialDaysLeft, 0);
assert.equal(lastDay.trialHoursLeft, 5);
assert.equal(lastDay.trialLabel, 'Ends in 5 hours');
assert.equal(lastDay.trialEndingSoon, true, 'the last 48 hours get loud');

// A date that cannot be read is treated as no entitlement rather than as an endless trial.
// Failing closed is the only safe direction here: the alternative hands out the paid product.
const broken = accessView(ent({ inTrial: true, expiresAt: 'not-a-date' }), 300, NOW);
assert.equal(broken.level, 'locked');
assert.equal(broken.appLocked, true);
assert.equal(broken.trialDaysLeft, null);

// ── Settings that stay reachable ──────────────────────────────────────────────
// Somebody who has not paid must still be able to leave, and to read what they agreed to.
for (const key of ['deleteAccount', 'transferOwnership', 'terms', 'privacy', 'support', 'signOut']) {
  assert.equal(settingsAllowedWhenLocked(key), true, `${key} must stay reachable`);
}
for (const key of ['notifications', 'rewards', 'houseRules', 'poppins', 'appearance', 'alerts']) {
  assert.equal(settingsAllowedWhenLocked(key), false, `${key} is for paying households`);
}
assert.ok(UNPAID_SETTINGS_KEYS.includes('subscription'), 'and the way to start paying');

// ── Lock copy ─────────────────────────────────────────────────────────────────
const trialCopy = poppinsLockCopy(trial, 300);
assert.match(trialCopy.body, /300/, 'it names what subscribing gets you');
assert.equal(trialCopy.secondary, 'Buy actions', 'a trial can still try Poppins by the pack');

const lockedCopy = poppinsLockCopy(locked, 300);
assert.equal(lockedCopy.secondary, null, 'a locked household subscribes or does nothing');

console.log('access-gate: ok');

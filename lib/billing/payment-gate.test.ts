/**
 * The payment gate's rules, pinned against the screens that enforce them.
 *
 * Most of the logic is pure and tested beside it (access-gate, household-entitlement,
 * allowance-state). What is left is wiring — which screen reads what, and in what order — and
 * each rule here exists because getting it wrong either gives the product away or locks out a
 * household that paid.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

// ── StoreKit decides the trial, not the app ───────────────────────────────────
const iap = read('lib/billing/iap.ts');
// Every purchase used to be marked a trial and every refresh marked not one.
assert.doesNotMatch(
  iap,
  /entitlementFromPurchase\(\{\s*productId,\s*inTrial: true,\s*\}\)/,
  'purchase no longer assumes a trial'
);
assert.doesNotMatch(
  iap,
  /expiresAt,\s*inTrial: false,\s*\}\);\s*return persistEntitlement\(state\);/,
  'refresh no longer assumes a paid period'
);
assert.match(iap, /readStoreKitSubscription/, 'one reader asks StoreKit');
assert.match(iap, /onlyIncludeActiveItemsIOS: true/, 'and reads current entitlements only');
assert.match(iap, /isEligibleForIntroOfferIOS/, 'trial eligibility comes from Apple');
assert.match(iap, /introductoryPricePaymentModeIOS/, 'and from the product actually having one');

// ── The tabs are the gate, and only once the state is known ──────────────────
const tabs = read('app/(tabs)/_layout.tsx');
assert.match(tabs, /access\.ready && access\.view\.appLocked/, 'never gate on an unknown state');
// Only an admin is ever sent to a purchase screen.
assert.match(tabs, /if \(access\.canPurchase\)\s*\{[\s\S]*?pathname: '\/premium'/);
assert.match(tabs, /<HouseholdLockedScreen/, 'everyone else is told who can fix it');

const locked = read('components/orbit/billing/household-locked-screen.tsx');
assert.doesNotMatch(locked, /purchasePremium|purchaseTokens|\/premium|Subscribe/, 'no purchase on a child\'s device');

const provider = read('lib/billing/access-provider.tsx');
assert.match(provider, /currentMember\?\.role === 'owner' \|\| currentMember\?\.role === 'admin'/);

// ── The paywall as a gate ─────────────────────────────────────────────────────
const premium = read('app/premium.tsx');
// No "Not now" after sign-up, or once a trial ends. Settings may still close it.
assert.match(premium, /const dismissible = !gated && !fromOnboarding;/);
// It steps aside by itself when the household is already covered by another admin.
assert.match(premium, /stepAsideRef/);
// Purchases and restores re-read StoreKit before landing back in the tabs.
assert.match(premium, /await access\.refresh\(\);/);

const paywall = read('components/orbit/premium-paywall.tsx');
assert.match(paywall, /dismissible \? \(/, 'the dismiss link is conditional');
assert.match(paywall, /Account/, 'and the gate offers Account instead');
// Trial wording only where StoreKit says the trial applies.
assert.match(paywall, /trialEligible \? 'Start Free Trial' : 'Subscribe'/);
assert.match(paywall, /Payment is charged to your Apple ID when you confirm/);
// Still carries what 3.1.2 needs, in both states.
assert.match(paywall, /CHOREMAXX_LEGAL\.termsUrl/);
assert.match(paywall, /CHOREMAXX_LEGAL\.privacyUrl/);
assert.match(paywall, /onRestore/);

// Guideline 5.1.1(v): an account that can be made can be deleted, from inside the app.
const sheet = read('components/orbit/billing/account-escape-sheet.tsx');
assert.match(sheet, /\/delete-account/);
assert.match(sheet, /Restore purchases/);
assert.match(sheet, /Sign out/);

// ── Poppins on a trial ────────────────────────────────────────────────────────
const poppins = read('app/(tabs)/poppins.tsx');
assert.match(
  poppins,
  /access\.ready && access\.view\.level === 'trial' && bought !== null && bought <= 0/,
  'locked only on a trial, only with nothing bought, only once both are known'
);
const lock = read('components/orbit/billing/poppins-trial-lock.tsx');
assert.match(lock, /\/poppins-credits/, 'the way in is buying actions');
assert.doesNotMatch(lock, /purchasePremium|Subscribe</, 'not selling a trial user what they have');

// Bought credits count at the gate — they used to be ignored once the month ran out.
const store = read('store/orbit-store.tsx');
assert.doesNotMatch(store, /if \(summarizeActUsage\(actEventsRef\.current\)\.tripped\)/);
assert.match(store, /poppinsMeterTripped/);
assert.match(store, /currentMonthlyAllowance\(\) - before\.tokensUsedThisPeriod/, 'trial charges come from credits');

// ── The household, not the phone ──────────────────────────────────────────────
const mapping = read('lib/household/map-household-settings.ts');
assert.match(mapping, /mapHouseholdPremiumFromRow/, 'both hydration paths carry Premium');
const migration = read('supabase/migrations/20261007120000_household_premium.sql');
assert.match(migration, /households_premium_server_only/, 'clients cannot write it');
assert.match(migration, /households_premium_original_transaction_uidx/, 'one subscription, one house');
const sync = read('supabase/functions/sync-entitlement/index.ts');
assert.match(sync, /\['owner', 'admin'\]/, 'only admins report a subscription');
assert.match(sync, /shorter_than_current/, 'a stale report cannot shorten a longer period');

console.log('payment-gate: ok');

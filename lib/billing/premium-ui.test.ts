/**
 * Stop 6 — Premium UI polish contracts.
 * Run: npx --yes tsx --test lib/billing/premium-ui.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PREMIUM_ALLOWANCE_COPY,
  premiumAllowanceCopy,
} from '@/constants/billing';
import { TOKENS_PER_DAY, TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';

test('allowance copy omits redundant daily when soft cap equals monthly', () => {
  assert.equal(TOKENS_PER_DAY, TOKENS_PER_MONTH, 'current rates: daily soft cap equals monthly pool');
  assert.equal(PREMIUM_ALLOWANCE_COPY, `${TOKENS_PER_MONTH} Poppins actions a month.`);
  assert.doesNotMatch(PREMIUM_ALLOWANCE_COPY, /a day/i);
});

test('allowance copy names daily soft cap when it paces the month', () => {
  assert.equal(
    premiumAllowanceCopy(300, 30),
    '300 Poppins actions a month · up to 30 a day.'
  );
});

test('settings premium section is glass hero + one primary CTA', () => {
  const settings = readFileSync(join(process.cwd(), 'app/settings.tsx'), 'utf8');
  assert.match(settings, /premiumHero/);
  assert.match(settings, /OrbitButton/);
  assert.match(settings, /PREMIUM_ALLOWANCE_COPY/);
  assert.match(settings, /Restore purchases/);
  assert.doesNotMatch(settings, /SectionCard title="Premium"/);
  assert.doesNotMatch(settings, /Open Premium/);
});

test('paywall uses monthly/yearly segment and period-aware trial', () => {
  const paywall = readFileSync(
    join(process.cwd(), 'components/orbit/premium-paywall.tsx'),
    'utf8'
  );
  assert.match(paywall, /SegmentedControl/);
  assert.match(paywall, /priceCrossfade|priceOpacity/);
  assert.match(paywall, /onStartTrial: \(period: IapProductKey\) => void/);
  assert.match(paywall, /PREMIUM_ALLOWANCE_COPY/);
  assert.doesNotMatch(paywall, /onStartMonthly/);
  assert.doesNotMatch(paywall, /Or \$\$\{monthly\.priceUsd\}\/month after trial/);
});

test('premium screen passes selected period into purchasePremium', () => {
  const screen = readFileSync(join(process.cwd(), 'app/premium.tsx'), 'utf8');
  assert.match(screen, /onStartTrial=\{\(period\) => void startTrial\(period\)\}/);
  assert.doesNotMatch(screen, /onStartMonthly/);
});

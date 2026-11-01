import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('subscription started email template exports subject and text', async () => {
  const mod = await import('../../emails/subscription-started');
  const props = {
    name: 'Sarah Chen',
    plan: 'Choremaxx Premium Yearly',
    price: '$49.99/year',
    renewalDate: 'October 12, 2026',
    manageUrl: 'https://www.choremaxx.app',
    inTrial: true,
    mock: true,
  };
  assert.match(mod.subjectFor(props), /free trial started/);
  const text = mod.textFor(props);
  assert.match(text, /congratulations/i);
  assert.match(text, /\$49\.99/);
  assert.match(text, /Test purchase/);
  assert.match(mod.subjectFor({ ...props, inTrial: false }), /subscription is active/);
});

test('edge branded HTML marks trial and mock note', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/send-subscription-receipt/branded-html.ts'),
    'utf8'
  );
  assert.match(src, /renderSubscriptionReceiptEmail/);
  assert.match(src, /free trial started/);
  assert.match(src, /Test purchase/);
});

test('premium screen wires purchasePremium and sendSubscriptionReceiptEmail', () => {
  const premium = readFileSync(join(process.cwd(), 'app/premium.tsx'), 'utf8');
  assert.match(premium, /purchasePremium/);
  assert.match(premium, /sendSubscriptionReceiptEmail/);
});

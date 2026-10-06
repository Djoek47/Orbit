import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('credit purchase email template exports subject and text', async () => {
  const mod = await import('../../emails/credit-purchase');
  const props = {
    name: 'Alex Rivera',
    tokens: 600,
    price: '$4.99',
    orderId: 'CMX-1111-2222-3333',
    householdName: 'The Rivera house',
    mock: true,
    creditsUrl: 'https://www.choremaxx.app',
  };
  assert.match(mod.subjectFor(props), /600 Poppins actions/);
  const text = mod.textFor(props);
  assert.match(text, /congratulations/i);
  assert.match(text, /\$4\.99/);
  assert.match(text, /never expire/i);
  assert.match(text, /Test purchase/);
});

test('edge branded HTML celebrates pack size and mock note', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase/functions/send-credit-receipt/branded-html.ts'),
    'utf8'
  );
  assert.match(src, /Congratulations/);
  assert.match(src, /never expire/i);
  assert.match(src, /Test purchase/);
  assert.match(src, /renderCreditReceiptEmail/);
});

test('credits screen wires purchaseTokens and sendCreditReceiptEmail', () => {
  const credits = readFileSync(join(process.cwd(), 'app/poppins-credits.tsx'), 'utf8');
  assert.match(credits, /purchaseTokens/);
  assert.match(credits, /sendCreditReceiptEmail/);
  assert.match(credits, /confirmCreditPackPurchase/);
  assert.doesNotMatch(credits, /from ['"]@\/components\/orbit\/orbit-alert['"]/);
  assert.doesNotMatch(credits, /orbitAlert\s*\(/);
  assert.match(credits, /Congratulations!/);
});

test('delete household leaves modals before tabs', () => {
  const del = readFileSync(join(process.cwd(), 'app/delete-household.tsx'), 'utf8');
  assert.match(del, /leaveModalsToTabs/);
});

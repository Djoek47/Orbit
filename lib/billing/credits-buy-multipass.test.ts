/**
 * Multipass: credit pack buy must never nest orbitAlert under Settings,
 * must grant via purchaseTokens, and must celebrate + email on success.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('Pass A: credits buy uses native Alert confirm, never orbitAlert', () => {
  const credits = read('app/poppins-credits.tsx');
  const menus = read('lib/ui/settings-native-menus.ts');
  assert.match(credits, /confirmCreditPackPurchase/);
  assert.match(menus, /confirmCreditPackPurchase/);
  assert.match(menus, /Alert\.alert/);
  assert.doesNotMatch(credits, /from ['"]@\/components\/orbit\/orbit-alert['"]/);
  assert.doesNotMatch(credits, /orbitAlert\s*\(/);
  assert.match(credits, /Buy \(test\)/);
});

test('Pass B: successful buy grants tokens, files receipt, sends email', () => {
  const credits = read('app/poppins-credits.tsx');
  assert.match(credits, /purchaseTokens/);
  assert.match(credits, /fileReceipt/);
  assert.match(credits, /sendCreditReceiptEmail/);
  assert.match(credits, /setCongrats/);
  assert.match(credits, /Congratulations!/);
  assert.match(credits, /readBalance/);
  assert.match(credits, /setBuying\(null\)/);
});

test('Pass B2: one calm success card — receipt email status lives inside it, never raw errors', () => {
  const credits = read('app/poppins-credits.tsx');
  assert.match(credits, /ReceiptMailRow/);
  assert.match(credits, /kind: 'sending'/);
  assert.match(credits, /View receipt/);
  assert.doesNotMatch(credits, /email pending \(\$\{mailed\.error\}\)/, 'no raw edge error in UI');
  assert.doesNotMatch(credits, /emailBanner/, 'no second orange banner under the packs');
  const runPurchase = credits.slice(
    credits.indexOf('const runPurchase'),
    credits.indexOf('const buy = useCallback')
  );
  assert.ok(runPurchase.length > 200, 'found the purchase flow');
  assert.doesNotMatch(
    runPurchase,
    /setOpenReceipt\(receipt\)/,
    'receipt opens on tap, not on top of the celebration'
  );
  assert.match(credits, /seq === purchaseSeq\.current\) setBuying\(null\)/);
});

test('Pass C: errors use native feedback Alert (no orbitAlert under Settings)', () => {
  const credits = read('app/poppins-credits.tsx');
  assert.match(credits, /showNativeAppError/);
  assert.match(credits, /That didn't go through/);
  assert.match(credits, /isUserCancelledPurchase/);
  assert.doesNotMatch(credits, /orbitAlert\([\s\S]*didn't go through/);
  assert.doesNotMatch(credits, /from ['"]@\/components\/orbit\/orbit-alert['"]/);
  const native = read('lib/errors/show-native-app-error.ts');
  assert.match(native, /recordAppError/);
  assert.match(native, /Send feedback/);
  assert.match(native, /Alert\.alert/);
  assert.match(native, /\/support\?errorId=/);
});

test('Pass C2: purchase errors never stringify to [object Object]', () => {
  const iap = read('lib/billing/iap.ts');
  assert.match(iap, /rejectPurchaseError/);
  assert.match(iap, /formatUnknownError/);
  assert.match(iap, /sku_not_found/);
  assert.match(iap, /fetchProducts/);
  const fmt = read('lib/errors/unknown-error.ts');
  assert.match(fmt, /\[object Object\]/);
});

test('Pass C2b: Credits keeps every pack tappable; StoreKit says so if a SKU is not live', () => {
  const credits = read('app/poppins-credits.tsx');
  const iap = read('lib/billing/iap.ts');
  // Credits used to grey out unlisted packs ("Soon"). That hid them during ASC review.
  // Now every pack stays on sale; purchaseTokens / friendly-error explain sku_not_found.
  assert.match(credits, /setAvailablePacks\(null\)/);
  assert.match(credits, /Every pack stays on sale|tap always reaches StoreKit/i);
  assert.doesNotMatch(credits, /probeAvailableTokenPacks/);
  assert.match(iap, /probeAvailableTokenPacks/, 'probe still exists for other surfaces');
  assert.match(iap, /sku_not_found/);
  const friendly = read('lib/errors/friendly-error.ts');
  const skuIdx = friendly.indexOf("lower.includes('sku_not_found')");
  assert.ok(skuIdx > 0, 'sku_not_found has dedicated friendly copy');
  assert.match(friendly.slice(skuIdx, skuIdx + 280), /not for sale|another size|App Store/i);
});

test('Pass C3: token pack listener ignores other SKUs; grant errors dig edge body', () => {
  const iap = read('lib/billing/iap.ts');
  assert.match(iap, /eventProductId !== pack\.productId/);
  assert.match(iap, /finish after grant/);
  const grants = read('lib/billing/token-grants.ts');
  assert.match(grants, /edgeErrorMessage/);
  assert.match(grants, /grant_token_pack_failed/);
  const friendly = read('lib/errors/friendly-error.ts');
  const grantCheck = friendly.indexOf("lower.includes('grant_token_pack')");
  const non2xxCheck = friendly.indexOf("lower.includes('non-2xx')");
  assert.ok(
    grantCheck > 0 && non2xxCheck > grantCheck,
    'grant copy must beat non-2xx offline copy'
  );
});

test('Pass D: congratulations email template still celebrates purchase', async () => {
  const mod = await import('../../emails/credit-purchase');
  const props = {
    name: 'Alex',
    tokens: 200,
    price: '$1.99',
    orderId: 'CMX-0001-0002-0003',
    householdName: 'House',
    mock: true,
    creditsUrl: 'https://www.choremaxx.app',
  };
  assert.match(mod.subjectFor(props), /200 Poppins actions/);
  assert.match(mod.textFor(props), /congratulations/i);
});

test('Pass E: IAP mock path grants and appends to bank', () => {
  const iap = read('lib/billing/iap.ts');
  assert.match(iap, /grantTokenPack/);
  assert.match(iap, /mock-\$\{packKey\}/);
  assert.match(iap, /isNativeIapAvailable/);
});

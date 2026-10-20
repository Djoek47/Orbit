/**
 * Buy a Poppins credit pack and send the receipt — one path for every screen that sells packs,
 * so none of them can forget the email.
 */
import { purchaseTokens, isNativeIapAvailable, type IapTokenPackKey } from '@/lib/billing/iap';
import { sendCreditReceiptEmail, type CreditReceiptResult } from '@/lib/billing/send-credit-receipt';
import { buildTopUpReceipt, fileReceipt, type TopUpReceipt } from '@/lib/billing/topup-receipt';
import type { TokenGrant } from '@/lib/billing/token-grants';

export type BoughtPack = {
  grant: TokenGrant;
  receipt: TopUpReceipt;
  /** Resolves when the receipt email has been sent, skipped or failed. Never rejects. */
  mailed: Promise<CreditReceiptResult>;
};

export async function buyCreditPack(input: {
  packKey: IapTokenPackKey;
  householdId: string;
  householdName: string;
  priceLabel: string;
  email?: string | null;
  name?: string | null;
}): Promise<BoughtPack> {
  const mock = !isNativeIapAvailable();
  const grant = await purchaseTokens(input.packKey, input.householdId);
  const receipt: TopUpReceipt = {
    ...buildTopUpReceipt({
      packKey: input.packKey,
      to: input.email || 'this device (no email on file)',
      householdName: input.householdName,
    }),
    transactionId: grant.transactionId,
    tokens: grant.tokens,
    mock,
  };
  fileReceipt(receipt);
  const mailed = sendCreditReceiptEmail({
    to: input.email || undefined,
    name: input.name ?? undefined,
    tokens: grant.tokens,
    price: input.priceLabel,
    orderId: receipt.orderId,
    householdName: input.householdName,
    householdId: input.householdId,
    mock,
    transactionId: grant.transactionId,
  }).catch((error: unknown) => ({ ok: false as const, error: String(error) }));
  return { grant, receipt, mailed };
}

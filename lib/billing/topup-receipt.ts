/**
 * Mock top-up — the whole buying flow without a payment system behind it.
 *
 * The packs and prices are the real ones (constants/billing.ts). What's mocked is only the
 * money: a purchase mints a transaction id, grants the tokens through the existing grant
 * path, and writes a receipt into an inbox you can open on the device. That way the flow
 * can be walked end to end — pick a pack, confirm, see the balance rise, read the receipt —
 * before StoreKit is wired up.
 *
 * Pure module: no AsyncStorage, no Supabase, no react-native.
 */
import {
  IAP_CONSUMABLES,
  type IapTokenPackKey,
} from '@/constants/billing';

export type TopUpPack = {
  key: IapTokenPackKey;
  productId: string;
  /** "600 actions" */
  label: string;
  tokens: number;
  priceUsd: number;
  /** Cents per action — the honest comparison between packs. */
  centsPerAction: number;
  /** Set on the pack that is the best value. */
  best: boolean;
  /** "Save 33%" against the smallest pack, or null on the smallest. */
  savingLabel: string | null;
};

const PACK_ORDER: IapTokenPackKey[] = ['tokensSmall', 'tokensMedium', 'tokensLarge'];

export function topUpPacks(): TopUpPack[] {
  const rows = PACK_ORDER.map((key) => {
    const pack = IAP_CONSUMABLES[key];
    return {
      key,
      productId: pack.productId,
      label: pack.label,
      tokens: pack.tokens,
      priceUsd: pack.priceUsd,
      centsPerAction: (pack.priceUsd * 100) / pack.tokens,
    };
  });
  const cheapest = Math.min(...rows.map((row) => row.centsPerAction));
  const baseline = rows[0]!.centsPerAction;
  return rows.map((row) => {
    const saving = baseline > 0 ? 1 - row.centsPerAction / baseline : 0;
    return {
      ...row,
      best: row.centsPerAction === cheapest,
      savingLabel: saving >= 0.05 ? `Save ${Math.round(saving * 100)}%` : null,
    };
  });
}

export function topUpPack(key: IapTokenPackKey): TopUpPack {
  return topUpPacks().find((pack) => pack.key === key)!;
}

export function formatPrice(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/** "0.8¢ each" — how the packs are compared on screen. */
export function formatPerAction(centsPerAction: number): string {
  return `${centsPerAction.toFixed(centsPerAction < 1 ? 2 : 1)}¢ each`;
}

// ── Receipts ──────────────────────────────────────────────────────────────────

export type TopUpReceipt = {
  /** Shown on the receipt and used to make the grant idempotent. */
  orderId: string;
  transactionId: string;
  packKey: IapTokenPackKey;
  productId: string;
  tokens: number;
  priceUsd: number;
  /** What tax would be, were this real. Mock purchases are $0.00 tax. */
  taxUsd: number;
  totalUsd: number;
  to: string;
  householdName: string;
  purchasedAt: string;
  /** True on every receipt this build can produce. */
  mock: boolean;
};

/**
 * A stable-looking order id. `seed` makes it deterministic in tests; in the app it is the
 * purchase time in milliseconds.
 */
export function buildOrderId(seed: number): string {
  // Plain arithmetic, not bit shifts: a millisecond timestamp is well past 2^31.
  const n = Math.abs(Math.round(seed));
  const block = (divisor: number) => String(Math.floor(n / divisor) % 10_000).padStart(4, '0');
  return `CMX-${block(1)}-${block(10_000)}-${block(100_000_000)}`;
}

export function buildTopUpReceipt(input: {
  packKey: IapTokenPackKey;
  to: string;
  householdName: string;
  at?: Date | string;
  seed?: number;
}): TopUpReceipt {
  const pack = topUpPack(input.packKey);
  const at = input.at ? new Date(input.at) : new Date();
  const seed = input.seed ?? at.getTime();
  const orderId = buildOrderId(seed);
  return {
    orderId,
    transactionId: `mock-${orderId}`,
    packKey: input.packKey,
    productId: pack.productId,
    tokens: pack.tokens,
    priceUsd: pack.priceUsd,
    taxUsd: 0,
    totalUsd: pack.priceUsd,
    to: input.to.trim(),
    householdName: input.householdName.trim() || 'your household',
    purchasedAt: at.toISOString(),
    mock: true,
  };
}

export function receiptSubject(receipt: TopUpReceipt): string {
  return `Your ChoreMaxx receipt — ${receipt.tokens} Poppins actions`;
}

/**
 * The receipt, as the email body. Written the way a real one would be so the whole flow
 * can be checked, with one line that says plainly no money moved.
 */
export function receiptBody(receipt: TopUpReceipt): string {
  const when = new Date(receipt.purchasedAt);
  const date = `${when.toLocaleDateString()} at ${when.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
  return [
    `Thanks — ${receipt.tokens} Poppins actions have been added to ${receipt.householdName}.`,
    '',
    `Order    ${receipt.orderId}`,
    `Date     ${date}`,
    `Item     ${receipt.tokens} Poppins actions`,
    `Price    ${formatPrice(receipt.priceUsd)}`,
    `Tax      ${formatPrice(receipt.taxUsd)}`,
    `Total    ${formatPrice(receipt.totalUsd)}`,
    '',
    'Top-up actions never expire. Your monthly allowance is spent first, then these.',
    '',
    'TEST PURCHASE — no card was charged and no money moved.',
  ].join('\n');
}

/** One line for the list of past top-ups. */
export function receiptLine(receipt: TopUpReceipt): string {
  return `${receipt.tokens} actions · ${formatPrice(receipt.totalUsd)} · ${receipt.orderId}`;
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
// Mock mode has no mail server, so receipts land here and the settings page can show them.

const inbox: TopUpReceipt[] = [];

export function fileReceipt(receipt: TopUpReceipt): TopUpReceipt {
  if (inbox.some((row) => row.orderId === receipt.orderId)) {
    return inbox.find((row) => row.orderId === receipt.orderId)!;
  }
  inbox.unshift(receipt);
  if (inbox.length > 20) inbox.length = 20;
  return receipt;
}

export function receiptInbox(): TopUpReceipt[] {
  return [...inbox];
}

export function latestReceipt(): TopUpReceipt | null {
  return inbox[0] ?? null;
}

export function clearReceiptInbox(): void {
  inbox.length = 0;
}

/**
 * Client → send-credit-receipt edge → Resend (buyer inbox).
 * Best-effort: mock buys still grant tokens if email is unavailable.
 */
import { getSupabaseClient } from '@/lib/supabase/client';

export type CreditReceiptInput = {
  to?: string;
  name?: string;
  tokens: number;
  price: string;
  orderId: string;
  householdName: string;
  householdId?: string;
  mock?: boolean;
  transactionId?: string;
};

export type CreditReceiptResult =
  | { ok: true; to: string }
  | { ok: false; error: string; skipped?: boolean };

export async function sendCreditReceiptEmail(
  input: CreditReceiptInput
): Promise<CreditReceiptResult> {
  if (!input.tokens || input.tokens <= 0) {
    return { ok: false, error: 'Missing token amount.', skipped: true };
  }
  if (!input.orderId.trim()) {
    return { ok: false, error: 'Missing order id.', skipped: true };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        error: 'Not connected — receipt saved on this device only.',
        skipped: true,
      };
    }

    const { data, error } = await supabase.functions.invoke('send-credit-receipt', {
      body: {
        to: input.to?.trim() || undefined,
        name: input.name?.trim() || undefined,
        tokens: input.tokens,
        price: input.price,
        orderId: input.orderId,
        householdName: input.householdName,
        householdId: input.householdId,
        mock: Boolean(input.mock),
        transactionId: input.transactionId,
      },
    });

    if (error) {
      return { ok: false, error: error.message || 'Could not send receipt email.' };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return { ok: false, error: String((data as { error: string }).error) };
    }
    const to =
      data && typeof data === 'object' && 'to' in data
        ? String((data as { to: string }).to)
        : input.to ?? '';
    return { ok: true, to };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send receipt email.',
    };
  }
}

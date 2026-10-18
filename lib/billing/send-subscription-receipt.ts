/**
 * Client → send-subscription-receipt edge → Resend (buyer inbox).
 * Best-effort: mock trials still activate if email is unavailable.
 */
import { getSupabaseClient } from '@/lib/supabase/client';

export type SubscriptionReceiptInput = {
  to?: string;
  name?: string;
  plan: string;
  price: string;
  renewalDate: string;
  manageUrl?: string;
  inTrial?: boolean;
  mock?: boolean;
  householdId?: string;
};

export type SubscriptionReceiptResult =
  | { ok: true; to: string }
  | { ok: false; error: string; skipped?: boolean };

export async function sendSubscriptionReceiptEmail(
  input: SubscriptionReceiptInput
): Promise<SubscriptionReceiptResult> {
  if (!input.plan.trim() || !input.price.trim() || !input.renewalDate.trim()) {
    return { ok: false, error: 'Missing plan details.', skipped: true };
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

    const { data, error } = await supabase.functions.invoke('send-subscription-receipt', {
      body: {
        to: input.to?.trim() || undefined,
        name: input.name?.trim() || undefined,
        plan: input.plan,
        price: input.price,
        renewalDate: input.renewalDate,
        manageUrl: input.manageUrl,
        inTrial: Boolean(input.inTrial),
        mock: Boolean(input.mock),
        householdId: input.householdId,
      },
    });

    if (error) {
      return { ok: false, error: error.message || 'Could not send subscription email.' };
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
      error: error instanceof Error ? error.message : 'Could not send subscription email.',
    };
  }
}

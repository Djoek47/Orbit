/**
 * Client → send-household-deletion-email edge → Resend.
 * Used by admin test harness now; Stop 3 cron + Stop 4 recovery UI later.
 */
import { getSupabaseClient } from '@/lib/supabase/client';

export type DeletionEmailKind = 'reminder' | 'confirmed' | 'cancelled';
export type DeletionReminderStage = '7d' | '3d' | '24h' | '1h11m';

export type HouseholdDeletionEmailInput = {
  to?: string;
  name?: string;
  kind: DeletionEmailKind;
  stage?: DeletionReminderStage;
  householdName: string;
  householdId?: string;
  purgeDate?: string;
  recoverUrl?: string;
  optOutUrl?: string;
  confirmBy?: string;
  confirmUrl?: string;
  cancelUrl?: string;
  homeUrl?: string;
};

export type HouseholdDeletionEmailResult =
  | { ok: true; to: string; kind: DeletionEmailKind }
  | { ok: false; error: string; skipped?: boolean };

export async function sendHouseholdDeletionEmail(
  input: HouseholdDeletionEmailInput
): Promise<HouseholdDeletionEmailResult> {
  if (!input.householdName.trim()) {
    return { ok: false, error: 'Missing household name.', skipped: true };
  }
  if (input.kind === 'reminder' && input.stage && !['7d', '3d', '24h', '1h11m'].includes(input.stage)) {
    return { ok: false, error: 'Invalid reminder stage.', skipped: true };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        error: 'Not connected — email skipped on this device.',
        skipped: true,
      };
    }

    const { data, error } = await supabase.functions.invoke('send-household-deletion-email', {
      body: {
        to: input.to?.trim() || undefined,
        name: input.name?.trim() || undefined,
        kind: input.kind,
        stage: input.stage,
        householdName: input.householdName,
        householdId: input.householdId,
        purgeDate: input.purgeDate,
        recoverUrl: input.recoverUrl,
        optOutUrl: input.optOutUrl,
        confirmBy: input.confirmBy,
        confirmUrl: input.confirmUrl,
        cancelUrl: input.cancelUrl,
        homeUrl: input.homeUrl,
      },
    });

    if (error) {
      return { ok: false, error: error.message || 'Could not send deletion email.' };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return { ok: false, error: String((data as { error: string }).error) };
    }
    const to =
      data && typeof data === 'object' && 'to' in data
        ? String((data as { to: string }).to)
        : input.to ?? '';
    return { ok: true, to, kind: input.kind };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not send deletion email.',
    };
  }
}

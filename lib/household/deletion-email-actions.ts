/**
 * Client helpers for accelerated deletion confirm + reminder opt-out.
 */
import { getSupabaseClient } from '@/lib/supabase/client';
import { sendHouseholdDeletionEmail } from '@/lib/household/send-deletion-email';
import {
  formatHouseholdDeletionDate,
  IMMEDIATE_DELETION_CONFIRM_HOURS,
  scheduleImmediateDeletionConfirmDate,
} from '@/lib/household/household-deletion';

export type ImmediateDeletionResult = {
  scheduledFor: string;
  confirmToken: string;
  confirmExpiresAt: string;
};

export async function sendImmediateDeletionConfirmEmail(input: {
  to?: string;
  name?: string;
  householdName: string;
  householdId?: string;
  scheduledFor: string;
  confirmToken: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const confirmUrl = `https://www.choremaxx.app/confirm-household-delete?token=${encodeURIComponent(input.confirmToken)}`;
  const cancelUrl = 'https://www.choremaxx.app';
  const mailed = await sendHouseholdDeletionEmail({
    to: input.to,
    name: input.name,
    kind: 'confirmed',
    householdName: input.householdName,
    householdId: input.householdId,
    confirmBy: `${IMMEDIATE_DELETION_CONFIRM_HOURS} hours`,
    confirmUrl,
    cancelUrl,
    purgeDate: formatHouseholdDeletionDate(input.scheduledFor),
  });
  if (mailed.ok) return { ok: true };
  return { ok: false, error: mailed.error, skipped: mailed.skipped };
}

export async function sendDeletionCancelledEmail(input: {
  to?: string;
  name?: string;
  householdName: string;
  householdId?: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const mailed = await sendHouseholdDeletionEmail({
    to: input.to,
    name: input.name,
    kind: 'cancelled',
    householdName: input.householdName,
    householdId: input.householdId,
    homeUrl: 'https://www.choremaxx.app',
  });
  if (mailed.ok) return { ok: true };
  return { ok: false, error: mailed.error, skipped: mailed.skipped };
}

/** Mock-friendly token mint when edge/RPC unavailable. */
export function mintMockImmediateDeletion(): ImmediateDeletionResult {
  const scheduledFor = scheduleImmediateDeletionConfirmDate();
  const confirmToken = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    scheduledFor,
    confirmToken,
    confirmExpiresAt: scheduledFor,
  };
}

export async function invokeOptOutDeletionReminders(
  householdId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: true }; // mock / offline — Stop 4 persists locally
    }
    const { error } = await supabase.rpc('opt_out_household_deletion_reminders', {
      p_household_id: householdId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update preferences.',
    };
  }
}

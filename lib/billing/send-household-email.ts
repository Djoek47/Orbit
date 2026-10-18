/**
 * Client → send-household-email edge → Resend (the admin's own inbox).
 * Fire-and-forget: confirmations for a new Sidekick, a new shared device, and the trial ending.
 * The edge dedupes by (household, dedupeKey), so calling twice never sends twice.
 */
import { getSupabaseClient } from '@/lib/supabase/client';

export type HouseholdEmailInput =
  | { kind: 'sidekick_added'; householdId: string; subjectName: string; code?: string | null; dedupeKey: string }
  | { kind: 'shared_device_created'; householdId: string; subjectName: string; people?: string[]; dedupeKey: string }
  | { kind: 'trial_ending'; householdId: string; endsAt: string; priceLine?: string; dedupeKey: string };

export function sendHouseholdEmail(input: HouseholdEmailInput): void {
  const supabase = getSupabaseClient();
  if (!supabase || !input.householdId) return;
  void supabase.functions
    .invoke('send-household-email', { body: input })
    .then(({ error }) => {
      if (error) console.warn('household email not sent', error.message);
    })
    .catch(() => undefined);
}

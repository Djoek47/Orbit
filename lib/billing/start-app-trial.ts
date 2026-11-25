/**
 * Our own free trial, one per Choremaxx account (start_app_trial in Postgres).
 * Used when this phone's Apple ID already had Apple's trial, so a new account still gets one.
 */
import { getConfiguredSupabase } from '@/repositories/repository-utils';

export type AppTrialResult =
  | { ok: true; endsAt: string }
  | { ok: false; reason: 'trial_used' | 'already_covered' | 'forbidden' | 'error' };

export async function startAppTrial(householdId: string): Promise<AppTrialResult> {
  try {
    const supabase = getConfiguredSupabase('billing.startAppTrial');
    const { data, error } = await supabase.rpc('start_app_trial' as never, { p_household_id: householdId } as never);
    if (error) {
      const msg = String(error.message ?? '');
      if (msg.includes('trial_used')) return { ok: false, reason: 'trial_used' };
      if (msg.includes('already_covered')) return { ok: false, reason: 'already_covered' };
      if (msg.includes('forbidden')) return { ok: false, reason: 'forbidden' };
      return { ok: false, reason: 'error' };
    }
    return { ok: true, endsAt: String(data) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

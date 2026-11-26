/**
 * Our own free trial (start_app_trial in Postgres): when this phone's Apple ID already had
 * Apple's trial, one more account on that Apple ID gets one. After that, none.
 */
import { getConfiguredSupabase } from '@/repositories/repository-utils';

export type AppTrialResult =
  | { ok: true; endsAt: string }
  | { ok: false; reason: 'trial_used' | 'apple_trials_used' | 'already_covered' | 'forbidden' | 'error' };

export async function startAppTrial(householdId: string, appleKey: string | null): Promise<AppTrialResult> {
  try {
    const supabase = getConfiguredSupabase('billing.startAppTrial');
    const { data, error } = await supabase.rpc('start_app_trial' as never, { p_household_id: householdId, p_apple_key: appleKey } as never);
    if (error) {
      const msg = String(error.message ?? '');
      if (msg.includes('apple_trials_used')) return { ok: false, reason: 'apple_trials_used' };
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

/** True when this Apple ID already received the one extra trial. Unknown counts as not used. */
export async function appTrialUsedFor(appleKey: string): Promise<boolean> {
  try {
    const supabase = getConfiguredSupabase('billing.appTrialUsedFor');
    const { data, error } = await supabase.rpc('app_trial_used_for' as never, { p_apple_key: appleKey } as never);
    return !error && data === true;
  } catch {
    return false;
  }
}

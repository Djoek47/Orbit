import { getSupabaseClient } from '@/lib/supabase/client';

const REALTIME_TABLES = [
  'tasks',
  'grocery_items',
  'calendar_events',
  'household_members',
  'rewards',
  'badges',
  'notifications',
  'reward_redemptions',
  'smart_home_devices',
] as const;

/**
 * Subscribe to household-scoped Postgres changes.
 * Returns an unsubscribe function. No-ops when Supabase is unavailable.
 */
export function subscribeHouseholdRealtime(householdId: string, onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !householdId) {
    return () => undefined;
  }

  let channel = supabase.channel(`household-realtime:${householdId}`);

  for (const table of REALTIME_TABLES) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        onChange();
      }
    );
  }

  channel.subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

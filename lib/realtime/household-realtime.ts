import { AppState } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase/client';

const REALTIME_TABLES = [
  'tasks',
  'grocery_items',
  'calendar_events',
  'household_members',
  'notifications',
  'reward_redemptions',
] as const;

/** Backoff between reconnect attempts: 1s, 2s, 4s … capped at 30s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}

/**
 * Subscribe to household-scoped Postgres changes, and stay subscribed.
 *
 * The socket drops when iOS suspends the app, on a network change, or when the server closes
 * an idle channel. Before, the channel was subscribed once and never checked, so after any
 * drop the screen stopped updating until the app was killed. Now:
 * - a channel that errors, times out or closes is torn down and rebuilt with backoff;
 * - whenever it (re)connects, `onChange` runs once, because changes made while it was down
 *   were never delivered and must be fetched;
 * - coming back to the foreground forces a fresh channel.
 *
 * Returns an unsubscribe function. No-ops when Supabase is unavailable.
 */
export function subscribeHouseholdRealtime(householdId: string, onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !householdId) {
    return () => undefined;
  }

  let stopped = false;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let generation = 0;

  const teardown = () => {
    if (channel) {
      const old = channel;
      channel = null;
      void supabase.removeChannel(old);
    }
  };

  const schedule = () => {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = null;
      connect();
    }, reconnectDelay(attempt));
    attempt += 1;
  };

  const connect = () => {
    if (stopped) return;
    teardown();
    const mine = ++generation;
    let next = supabase.channel(`household-realtime:${householdId}:${mine}`);
    for (const table of REALTIME_TABLES) {
      next = next.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => onChange()
      );
    }
    channel = next;
    next.subscribe((status) => {
      if (stopped || mine !== generation) return;
      if (status === 'SUBSCRIBED') {
        attempt = 0;
        // Catch up on anything that changed while we weren't listening.
        onChange();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        schedule();
      }
    });
  };

  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active' || stopped) return;
    if (retry) {
      clearTimeout(retry);
      retry = null;
    }
    attempt = 0;
    connect();
  });

  connect();

  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    appState.remove();
    teardown();
  };
}

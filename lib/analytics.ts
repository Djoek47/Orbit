import { dataMode } from '@/config/data-mode';
import { getSupabaseClient } from '@/lib/supabase/client';

export async function trackAnalyticsEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  context?: { householdId?: string | null; userId?: string | null }
) {
  if (dataMode === 'mock') {
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.from('analytics_events').insert({
    event_name: eventName,
    properties: properties as import('@/types/database').Json,
    household_id: context?.householdId ?? null,
    user_id: context?.userId ?? null,
  });
}

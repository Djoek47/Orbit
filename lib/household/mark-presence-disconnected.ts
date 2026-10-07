/**
 * Stamp last_seen so admin roster flips Connected → Disconnected after leave.
 * Clears the channel that matches this device (personal vs shared tablet).
 */
import { MEMBER_LIVE_MS } from '@/lib/household/member-presence';

/** last_seen older than the live window by one minute. */
export function disconnectedLastSeenIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - MEMBER_LIVE_MS - 60_000).toISOString();
}

/**
 * Best-effort: clear live presence for faces leaving this device.
 * Never throws — sign-out must continue even if presence update fails.
 */
export async function markPresenceDisconnected(input: {
  memberIds: string[];
  /** Personal Sidekick profile code — uses edge when JWT may be absent. */
  profileInviteCode?: string | null;
  /** When set, clear shared-tablet channel for this shell; otherwise personal. */
  hostKind?: 'sidekick' | 'shared-tablet' | null;
  sharedDeviceId?: string | null;
}): Promise<void> {
  const ids = [...new Set(input.memberIds.filter(Boolean))];
  if (ids.length === 0) return;

  const seenAt = disconnectedLastSeenIso();
  const isShared =
    input.hostKind === 'shared-tablet' || Boolean(input.sharedDeviceId?.trim());

  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client');
    const supabase = getSupabaseClient();
    if (supabase) {
      const patch = isShared
        ? {
            last_seen_at: seenAt,
            shared_last_seen_at: seenAt,
            shared_active_on_device_id: null as string | null,
          }
        : {
            last_seen_at: seenAt,
            personal_last_seen_at: seenAt,
          };
      const { error } = await supabase.from('household_members').update(patch).in('id', ids);
      if (!error) return;
      console.warn('markPresenceDisconnected.client', error.message);
    }
  } catch (error) {
    console.warn('markPresenceDisconnected.client', error);
  }

  const code = input.profileInviteCode?.trim();
  if (!code) return;

  try {
    const { getSupabaseClient } = await import('@/lib/supabase/client');
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.functions.invoke('sidekick-sync', {
      body: {
        code,
        disconnect: true,
        ...(isShared
          ? {
              hostKind: 'shared-tablet',
              sharedDeviceId: input.sharedDeviceId ?? undefined,
            }
          : { hostKind: 'sidekick' }),
      },
    });
  } catch (error) {
    console.warn('markPresenceDisconnected.edge', error);
  }
}

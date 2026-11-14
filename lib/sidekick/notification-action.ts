/**
 * Sidekick / profile-code notification dismiss + mark-read (no JWT).
 */

import { dataMode } from '@/config/data-mode';
import { withMemberDismissed } from '@/lib/ai/daily-insight';
import { isSidekickLocalUserId, loadSidekickSession } from '@/lib/sidekick/session';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { NotificationItem } from '@/types/orbit';

export async function sidekickDismissNotification(input: {
  code: string;
  notificationId: string;
  memberId: string;
}): Promise<NotificationItem | null> {
  if (dataMode !== 'supabase') return null;
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client unavailable');
  }

  const { data, error } = await supabase.functions.invoke('sidekick-notification-action', {
    body: {
      action: 'dismiss',
      code: input.code,
      notificationId: input.notificationId,
    },
  });

  if (error) {
    throw new Error(error.message || 'sidekickDismissNotification failed');
  }

  const payload = data as {
    error?: string;
    notification?: {
      id: string;
      household_id: string;
      title: string;
      body: string;
      category: NotificationItem['category'];
      priority: NotificationItem['priority'];
      is_read: boolean;
      created_at: string;
      data: unknown;
    };
  };

  if (payload?.error || !payload?.notification) {
    throw new Error(payload?.error ?? 'sidekickDismissNotification empty response');
  }

  const row = payload.notification;
  const rawData =
    row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    isRead: row.is_read,
    createdAt: row.created_at,
    data: withMemberDismissed(rawData, input.memberId),
  };
}

export async function sidekickMarkNotificationRead(input: {
  code: string;
  notificationId: string;
}): Promise<boolean> {
  if (dataMode !== 'supabase') return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await supabase.functions.invoke('sidekick-notification-action', {
    body: {
      action: 'mark_read',
      code: input.code,
      notificationId: input.notificationId,
    },
  });

  if (error) {
    console.warn('sidekickMarkNotificationRead', error.message);
    return false;
  }
  const payload = data as { error?: string; ok?: boolean };
  return !payload?.error && payload?.ok !== false;
}

/**
 * Sidekick profile-code auth for notification writes.
 * Skips when a real JWT session is active (admin / co-admin).
 */
export async function sidekickNotificationAuth(): Promise<{
  code: string;
  memberId: string;
} | null> {
  if (dataMode !== 'supabase') return null;

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId && !isSidekickLocalUserId(userId)) {
      return null;
    }
  }

  const session = await loadSidekickSession();
  if (!session?.profileInviteCode?.trim()) return null;
  return {
    code: session.profileInviteCode.trim().toUpperCase(),
    memberId: session.memberId,
  };
}

import { createLocalId, getConfiguredSupabase, isMockMode, isPersistedHouseholdId, mapDbError } from '@/repositories/repository-utils';
import { withMemberDismissed } from '@/lib/ai/daily-insight';
import type { NotificationItem } from '@/types/orbit';

export type CreateNotificationInput = {
  householdId: string;
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority?: NotificationItem['priority'];
  data?: Record<string, unknown>;
  userId?: string | null;
};

const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    householdId: 'hh-rivera',
    title: 'Laundry overdue',
    body: 'David still has laundry fold and put away marked overdue.',
    category: 'tasks',
    priority: 'high',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    data: { taskId: 't3' },
  },
  {
    id: 'n2',
    householdId: 'hh-rivera',
    title: 'Milk is missing',
    body: 'Milk was marked missing from the fridge list.',
    category: 'groceries',
    priority: 'medium',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    data: { groceryId: 'g1' },
  },
  {
    id: 'n3',
    householdId: 'hh-rivera',
    title: 'Emma soccer practice',
    body: 'Starts today at 5:30 PM at Riverside Field. David is responsible.',
    category: 'events',
    priority: 'medium',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    data: { eventId: 'e1' },
  },
  {
    id: 'n4',
    householdId: 'hh-rivera',
    title: 'Reward approval waiting',
    body: 'Emma requested 30 minutes of screen time.',
    category: 'rewards',
    priority: 'low',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    data: { rewardId: 'r1' },
  },
  {
    id: 'n5',
    householdId: 'hh-rivera',
    title: 'Poppins suggestion',
    body: 'Rebalance open tasks before school pickup at 3:00 PM.',
    category: 'ai',
    priority: 'medium',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
];

let mockNotificationState = clone(mockNotifications);

function mapNotificationRow(row: {
  id: string;
  household_id: string;
  title: string;
  body: string;
  category: NotificationItem['category'];
  priority: NotificationItem['priority'];
  is_read: boolean;
  created_at: string;
  data: unknown;
}): NotificationItem {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    body: row.body,
    category: row.category,
    priority: row.priority,
    isRead: row.is_read,
    createdAt: row.created_at,
    data:
      row.data && typeof row.data === 'object' && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : undefined,
  };
}

export const notificationsRepository = {
  async list(householdId?: string | null): Promise<NotificationItem[]> {
    if (isMockMode()) {
      const items = householdId
        ? mockNotificationState.filter((item) => item.householdId === householdId)
        : clone(mockNotificationState);
      return items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

    const supabase = getConfiguredSupabase('notificationsRepository.list');
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });

    if (householdId) {
      if (!isPersistedHouseholdId(householdId)) {
        return [];
      }
      query = query.eq('household_id', householdId);
    }

    const { data, error } = await query;
    mapDbError('notificationsRepository.list', error);

    return (data ?? []).map((row) => mapNotificationRow(row));
  },

  async markRead(notificationId: string): Promise<NotificationItem | null> {
    if (isMockMode()) {
      mockNotificationState = mockNotificationState.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item
      );
      return mockNotificationState.find((item) => item.id === notificationId) ?? null;
    }

    const supabase = getConfiguredSupabase('notificationsRepository.markRead');
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select('*')
      .maybeSingle();
    mapDbError('notificationsRepository.markRead', error);

    return data ? mapNotificationRow(data) : null;
  },

  async markAllRead(householdId?: string | null): Promise<void> {
    if (isMockMode()) {
      mockNotificationState = mockNotificationState.map((item) =>
        !householdId || item.householdId === householdId ? { ...item, isRead: true } : item
      );
      return;
    }

    const supabase = getConfiguredSupabase('notificationsRepository.markAllRead');
    const { data: authData } = await supabase.auth.getUser();
    let query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false);

    if (authData.user?.id) {
      query = query.eq('user_id', authData.user.id);
    }
    if (householdId) {
      query = query.eq('household_id', householdId);
    }

    const { error } = await query;
    mapDbError('notificationsRepository.markAllRead', error);
  },

  async create(input: CreateNotificationInput): Promise<NotificationItem> {
    if (isMockMode()) {
      const item: NotificationItem = {
        id: createLocalId('notification'),
        householdId: input.householdId,
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority ?? 'medium',
        isRead: false,
        createdAt: new Date().toISOString(),
        data: input.data,
      };
      mockNotificationState = [item, ...mockNotificationState];
      return item;
    }

    const supabase = getConfiguredSupabase('notificationsRepository.create');
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        household_id: input.householdId,
        user_id: input.userId ?? authData.user?.id ?? null,
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority ?? 'medium',
        data: (input.data ?? {}) as import('@/types/database').Json,
        is_read: false,
      })
      .select('*')
      .single();
    mapDbError('notificationsRepository.create', error);

    if (!data) {
      throw new Error('notificationsRepository.create: Insert returned no row.');
    }

    return mapNotificationRow(data);
  },

  async updateCopy(
    notificationId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<NotificationItem | null> {
    if (isMockMode()) {
      mockNotificationState = mockNotificationState.map((item) =>
        item.id === notificationId
          ? { ...item, title, body, data: data ? { ...item.data, ...data } : item.data }
          : item
      );
      return mockNotificationState.find((item) => item.id === notificationId) ?? null;
    }

    const supabase = getConfiguredSupabase('notificationsRepository.updateCopy');
    const { data: row, error } = await supabase
      .from('notifications')
      .update({
        title,
        body,
        ...(data ? { data: data as import('@/types/database').Json } : {}),
      })
      .eq('id', notificationId)
      .select('*')
      .maybeSingle();
    mapDbError('notificationsRepository.updateCopy', error);
    return row ? mapNotificationRow(row) : null;
  },

  /** Persist per-member dismiss so Sidekick / co-admin deletes stay deleted. */
  async dismissForMember(
    notificationId: string,
    memberId: string
  ): Promise<NotificationItem | null> {
    if (isMockMode()) {
      mockNotificationState = mockNotificationState.map((item) => {
        if (item.id !== notificationId) return item;
        return {
          ...item,
          isRead: true,
          data: withMemberDismissed(item.data, memberId),
        };
      });
      return mockNotificationState.find((item) => item.id === notificationId) ?? null;
    }

    const supabase = getConfiguredSupabase('notificationsRepository.dismissForMember');
    const { data: existing, error: loadError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .maybeSingle();
    mapDbError('notificationsRepository.dismissForMember.load', loadError);
    if (!existing) return null;

    const prevData =
      existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
        ? (existing.data as Record<string, unknown>)
        : {};
    const nextData = withMemberDismissed(prevData, memberId);

    const { data: row, error } = await supabase
      .from('notifications')
      .update({
        data: nextData as import('@/types/database').Json,
        is_read: true,
      })
      .eq('id', notificationId)
      .select('*')
      .maybeSingle();
    mapDbError('notificationsRepository.dismissForMember', error);
    return row ? mapNotificationRow(row) : null;
  },

  /** @deprecated Prefer create() — kept for older callers. */
  async createMock(notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'> & { id?: string }) {
    return this.create({
      householdId: notification.householdId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      priority: notification.priority,
      data: notification.data,
    });
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

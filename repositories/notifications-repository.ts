import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { NotificationItem } from '@/types/orbit';

const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    householdId: 'hh-rivera',
    title: 'Laundry overdue',
    body: 'David still has laundry fold and put away marked overdue.',
    category: 'tasks',
    priority: 'high',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    householdId: 'hh-rivera',
    title: 'Milk is missing',
    body: 'Milk was marked missing from the fridge list.',
    category: 'groceries',
    priority: 'medium',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n3',
    householdId: 'hh-rivera',
    title: 'Emma soccer practice',
    body: 'Starts today at 5:30 PM at Riverside Field.',
    category: 'events',
    priority: 'medium',
    isRead: true,
    createdAt: new Date().toISOString(),
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
      return householdId
        ? mockNotificationState.filter((item) => item.householdId === householdId)
        : clone(mockNotificationState);
    }

    const supabase = getConfiguredSupabase('notificationsRepository.list');
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });

    if (householdId) {
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

  async createMock(notification: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'> & { id?: string }) {
    if (!isMockMode()) {
      throw new Error('notificationsRepository.createMock is only available in mock mode.');
    }

    const item: NotificationItem = {
      id: notification.id ?? createLocalId('notification'),
      householdId: notification.householdId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      priority: notification.priority,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: notification.data,
    };
    mockNotificationState = [item, ...mockNotificationState];
    return item;
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

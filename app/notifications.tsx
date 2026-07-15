import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { getNotificationRoute } from '@/lib/notifications/navigate';
import { scheduleLocalReminder } from '@/lib/notifications/push';
import { useOrbit } from '@/store/orbit-store';
import type { NotificationItem } from '@/types/orbit';

type FilterKey = 'all' | 'unread' | NotificationItem['category'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Events' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'ai', label: 'Nova' },
];

export default function NotificationsScreen() {
  const {
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    refreshNotifications,
    unreadNotificationCount,
  } = useOrbit();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [reminderStatus, setReminderStatus] = useState('');

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') {
      return notifications;
    }
    if (filter === 'unread') {
      return notifications.filter((item) => !item.isRead);
    }
    return notifications.filter((item) => item.category === filter);
  }, [filter, notifications]);

  const openNotification = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markNotificationRead(item.id);
    }
    const route = getNotificationRoute(item);
    if (route) {
      router.push(route as never);
    }
  };

  const tryLocalReminder = async () => {
    try {
      await scheduleLocalReminder('Orbit check-in', 'Glance at Today’s tasks and calendar.', 15);
      setReminderStatus('Local reminder scheduled in about 15 seconds (Expo Go).');
    } catch {
      setReminderStatus('Reminders need notification permission on a physical device.');
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Inbox</Text>
        <Text style={orbitTypography.display}>Notifications</Text>
        <Text style={orbitTypography.body}>
          {unreadNotificationCount > 0
            ? `${unreadNotificationCount} unread household alerts`
            : 'You are caught up.'}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <OrbitButton disabled={unreadNotificationCount === 0} onPress={() => markAllNotificationsRead()}>
        Mark all read
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={tryLocalReminder}>
        Test local reminder
      </OrbitButton>
      {reminderStatus ? <Text style={styles.hint}>{reminderStatus}</Text> : null}

      {filtered.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.caption}>No notifications in this filter.</Text>
        </GlassCard>
      ) : (
        filtered.map((item) => (
          <Pressable key={item.id} onPress={() => openNotification(item)}>
            <GlassCard style={[styles.card, !item.isRead && styles.unreadCard]}>
              <View style={orbitScreen.row}>
                <StatusPill label={item.category} tone={item.isRead ? 'blue' : 'cyan'} />
                <StatusPill
                  label={item.priority}
                  tone={item.priority === 'high' || item.priority === 'critical' ? 'red' : 'amber'}
                />
              </View>
              <OrbitListItem meta={new Date(item.createdAt).toLocaleString()} title={item.title}>
                <Text style={orbitTypography.caption}>{item.body}</Text>
                <Text style={styles.openHint}>
                  {getNotificationRoute(item) ? 'Tap to open' : item.isRead ? 'Read' : 'Tap to mark read'}
                </Text>
              </OrbitListItem>
            </GlassCard>
          </Pressable>
        ))
      )}

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    paddingHorizontal: orbitSpacing.md,
    paddingVertical: orbitSpacing.sm,
  },
  filterChipActive: {
    backgroundColor: 'rgba(0, 194, 255, 0.16)',
    borderColor: 'rgba(0, 194, 255, 0.4)',
  },
  filterLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  filterLabelActive: {
    color: orbitColors.text,
  },
  filters: {
    gap: orbitSpacing.sm,
    paddingRight: orbitSpacing.md,
  },
  hint: {
    color: orbitColors.novaCyan,
    fontSize: 13,
    fontWeight: '700',
  },
  openHint: {
    color: orbitColors.novaCyan,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  unreadCard: {
    borderColor: 'rgba(0, 194, 255, 0.35)',
  },
});

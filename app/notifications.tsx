import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/orbit/glass-card';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { getNotificationRoute } from '@/lib/notifications/navigate';
import { useOrbit } from '@/store/orbit-store';
import type { NotificationItem } from '@/types/orbit';

type FilterKey = 'all' | 'unread' | NotificationItem['category'];

const PRIMARY_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

const CATEGORY_FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
  { key: 'tasks', label: 'Tasks', emoji: '✅' },
  { key: 'events', label: 'Plan', emoji: '📅' },
  { key: 'groceries', label: 'Grocery', emoji: '🛒' },
  { key: 'rewards', label: 'Rewards', emoji: '🎁' },
  { key: 'ai', label: 'Nova', emoji: '✨' },
];

const CATEGORY_META: Record<
  NotificationItem['category'],
  { emoji: string; label: string; color: string }
> = {
  tasks: { emoji: '✅', label: 'Tasks', color: '#34D399' },
  groceries: { emoji: '🛒', label: 'Grocery', color: '#FB923C' },
  events: { emoji: '📅', label: 'Plan', color: '#A78BFA' },
  rewards: { emoji: '🎁', label: 'Rewards', color: '#F59E0B' },
  ai: { emoji: '✨', label: 'Nova', color: '#2DD4BF' },
  general: { emoji: '🔔', label: 'General', color: '#3BB5F0' },
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((now - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    refreshNotifications,
    unreadNotificationCount,
  } = useOrbit();
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((item) => !item.isRead);
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

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[
        orbitScreen.content,
        { paddingTop: insets.top + orbitSpacing.md },
      ]}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.topBar}>
        <View style={styles.topCopy}>
          <Text style={orbitTypography.caption}>Inbox</Text>
          <Text style={orbitTypography.display}>Notifications</Text>
          <Text style={orbitTypography.body}>
            {unreadNotificationCount > 0
              ? `${unreadNotificationCount} unread household alert${unreadNotificationCount === 1 ? '' : 's'}`
              : 'You are caught up.'}
          </Text>
        </View>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeLabel}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        {PRIMARY_FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}>
              <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}>
        {CATEGORY_FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}>
              <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                {item.emoji} {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {unreadNotificationCount > 0 ? (
        <View style={styles.actionsRow}>
          <Text style={orbitTypography.cardTitle}>
            {filter === 'all' ? 'Latest' : filter === 'unread' ? 'Unread' : CATEGORY_META[filter as NotificationItem['category']]?.label ?? 'Filtered'}
          </Text>
          <Pressable onPress={() => markAllNotificationsRead()}>
            <Text style={styles.linkHint}>Mark all read</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={orbitTypography.cardTitle}>Latest</Text>
      )}

      {filtered.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.cardTitle}>All quiet</Text>
          <Text style={orbitTypography.caption}>
            No notifications in this filter. Household alerts from tasks, Plan, groceries, and Nova will land here.
          </Text>
        </GlassCard>
      ) : (
        filtered.map((item) => {
          const meta = CATEGORY_META[item.category];
          const canOpen = Boolean(getNotificationRoute(item));
          return (
            <Pressable key={item.id} onPress={() => openNotification(item)}>
              <GlassCard
                elevated={!item.isRead}
                style={[styles.card, !item.isRead && styles.unreadCard]}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBubble, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
                    <Text style={styles.iconEmoji}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!item.isRead ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.body} numberOfLines={3}>
                      {item.body}
                    </Text>
                    <View style={styles.metaRow}>
                      <StatusPill label={meta.label} tone={item.isRead ? 'blue' : 'cyan'} />
                      {(item.priority === 'high' || item.priority === 'critical') && (
                        <StatusPill label={item.priority} tone="red" />
                      )}
                      <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
                    </View>
                    {canOpen ? <Text style={styles.linkHint}>Tap to open</Text> : null}
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: {
    color: orbitColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    gap: orbitSpacing.sm,
  },
  cardCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: orbitRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(59,181,240,0.2)',
    borderColor: 'rgba(59,181,240,0.35)',
  },
  categoryLabel: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  categoryRow: {
    gap: 8,
    paddingRight: orbitSpacing.md,
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeLabel: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  iconBubble: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconEmoji: {
    fontSize: 20,
  },
  linkHint: {
    color: orbitColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: orbitColors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  titleUnread: {
    fontWeight: '800',
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: orbitRadius.md,
    flex: 1,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(59, 181, 240, 0.2)',
    borderColor: 'rgba(59, 181, 240, 0.3)',
    borderWidth: 1,
  },
  toggleLabel: {
    color: orbitColors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleLabelActive: {
    color: orbitColors.primary,
    fontWeight: '700',
  },
  toggleRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: orbitRadius.lg,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: orbitSpacing.md,
    justifyContent: 'space-between',
  },
  topCopy: {
    flex: 1,
    gap: orbitSpacing.xs,
  },
  unreadCard: {
    borderColor: 'rgba(59, 181, 240, 0.35)',
  },
  unreadDot: {
    backgroundColor: orbitColors.primary,
    borderRadius: 999,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  when: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
});

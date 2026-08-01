import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getNotificationRoute } from '@/lib/notifications/navigate';
import { useOrbit } from '@/store/orbit-store';
import type { NotificationItem } from '@/types/orbit';

type FilterKey = 'all' | 'unread' | NotificationItem['category'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'ai', label: 'Nova' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Events' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'rewards', label: 'Rewards' },
];

const CATEGORY_UI: Record<
  NotificationItem['category'],
  { icon: keyof typeof MaterialIcons.glyphMap; color: string; action: string; emoji: string }
> = {
  ai: { icon: 'auto-awesome', color: '#06B6D4', action: 'Nova', emoji: '🤖' },
  tasks: { icon: 'check-circle', color: '#34D399', action: 'Task', emoji: '✅' },
  events: { icon: 'event', color: '#A78BFA', action: 'Event', emoji: '📅' },
  groceries: { icon: 'shopping-cart', color: '#FB923C', action: 'Grocery', emoji: '🛒' },
  rewards: { icon: 'card-giftcard', color: '#FBBF24', action: 'Reward', emoji: '🎁' },
  members: { icon: 'group', color: '#38BDF8', action: 'Member', emoji: '👥' },
  general: { icon: 'notifications', color: '#7C9CC0', action: 'Alert', emoji: '🔔' },
};

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (Number.isNaN(diffMin)) return 'Just now';
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)} hr ago`;
  if (diffMin < 48 * 60) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Make v5 notifications inbox — AdminScreen sheet chrome + Nova Activity card pattern.
 * Looks-first port; keep existing mark-read / deep-link behavior.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const {
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    orbitPalette,
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
    <View
      style={[
        styles.shell,
        { paddingTop: insets.top, backgroundColor: orbitPalette.backgroundSoft },
      ]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.handleRow}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <LinearGradient colors={['#38BDF8', '#0EA5E9']} style={styles.iconBox}>
            <MaterialIcons name="notifications" size={16} color={orbitPalette.ink} />
          </LinearGradient>
          <View>
            <Text style={[styles.title, { color: orbitPalette.text }]}>Notifications</Text>
            <Text style={[styles.subtitle, { color: orbitPalette.textSubtle }]}>
              {unreadNotificationCount > 0
                ? `${unreadNotificationCount} unread`
                : 'You are caught up'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.close} onPress={() => router.back()}>
          <MaterialIcons name="close" size={16} color={orbitPalette.textMuted} />
        </Pressable>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
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
      </View>

      {unreadNotificationCount > 0 ? (
        <Pressable style={styles.markAllRow} onPress={() => markAllNotificationsRead()}>
          <MaterialIcons name="done-all" size={14} color="#38BDF8" />
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="notifications-none" size={28} color="#4B6080" />
            </View>
            <Text style={[styles.emptyTitle, { color: orbitPalette.text }]}>No notifications</Text>
            <Text style={[styles.emptyBody, { color: orbitPalette.textSubtle }]}>
              {filter === 'unread'
                ? 'Nothing unread in this inbox.'
                : 'Nova will drop household alerts here.'}
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const ui = CATEGORY_UI[item.category] ?? CATEGORY_UI.general;
            const high = item.priority === 'high' || item.priority === 'critical';
            return (
              <Pressable
                key={item.id}
                onPress={() => openNotification(item)}
                style={[
                  styles.card,
                  !item.isRead && styles.cardUnread,
                  high && !item.isRead && styles.cardUrgent,
                ]}>
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: `${ui.color}15`, borderColor: `${ui.color}25` },
                  ]}>
                  <MaterialIcons name={ui.icon} size={16} color={ui.color} />
                </View>
                <View style={styles.cardCopy}>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardAction, { color: ui.color }]}>{ui.action}</Text>
                    <Text style={styles.cardDot}>·</Text>
                    <Text style={styles.cardTime}>{formatRelativeTime(item.createdAt)}</Text>
                    {!item.isRead ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: orbitPalette.textSoft },
                      !item.isRead && [styles.cardTitleUnread, { color: orbitPalette.text }],
                    ]}
                    numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardDetail} numberOfLines={3}>
                    {item.body}
                  </Text>
                  {getNotificationRoute(item) ? (
                    <Text style={styles.openHint}>Tap to open</Text>
                  ) : null}
                </View>
                <Text style={styles.cardEmoji}>{ui.emoji}</Text>
              </Pressable>
            );
          })
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>Household inbox · Nova Monitor + app alerts</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 4,
    paddingTop: 12,
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  close: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  filterWrap: {
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  filters: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: 'rgba(56,189,248,0.3)',
  },
  filterLabel: {
    color: '#4B6080',
    fontSize: 13,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  markAllRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  markAllText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 10,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  cardUnread: {
    backgroundColor: 'rgba(56,189,248,0.06)',
    borderColor: 'rgba(56,189,248,0.22)',
  },
  cardUrgent: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  cardIcon: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardDot: {
    color: '#2A3A54',
    fontSize: 12,
  },
  cardTime: {
    color: '#2A3A54',
    fontSize: 12,
  },
  unreadDot: {
    backgroundColor: '#38BDF8',
    borderRadius: 3,
    height: 6,
    marginLeft: 2,
    width: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 2,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  cardDetail: {
    color: '#7C9CC0',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  openHint: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  cardEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
    width: 56,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerNote: {
    alignItems: 'center',
    paddingTop: 12,
  },
  footerText: {
    color: '#2A3A54',
    fontSize: 11,
    fontWeight: '600',
  },
});

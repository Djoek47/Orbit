import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { EmptyState } from '@/components/orbit/empty-state';
import { PageEyebrow } from '@/components/orbit/page-eyebrow';
import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { orbitScreen, radius, space, typography } from '@/constants/orbit-theme';
import {
  buildInboxSections,
  needsAttentionCount,
  routeForSheetCard,
  type InboxSection,
  type SheetNotificationCard,
} from '@/lib/poppins/notification-buckets';
import { factToActivityItem } from '@/lib/poppins/notification-policy';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type {
  OrbitMetrics,
  PoppinsWeeklyBriefing,
} from '@/types/orbit';

type InboxSegment = 'alerts' | 'activity';

type ActivityItem = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  category: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
};

const ACTION_CFG: Record<string, { color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  completed: { color: '#34D399', icon: 'check-circle' },
  tasks: { color: '#34D399', icon: 'check-circle' },
  reminder: { color: '#A78BFA', icon: 'notifications-active' },
  nudge: { color: '#FB923C', icon: 'campaign' },
  itinerary: { color: '#38BDF8', icon: 'place' },
  plan: { color: '#38BDF8', icon: 'map' },
  insight: { color: '#FBBF24', icon: 'lightbulb' },
  ai: { color: '#FBBF24', icon: 'lightbulb' },
  deals: { color: '#34D399', icon: 'local-offer' },
  rewards: { color: '#FB923C', icon: 'card-giftcard' },
  monitor: { color: '#06B6D4', icon: 'visibility' },
  notification: { color: '#FB923C', icon: 'notifications' },
  groceries: { color: '#FB923C', icon: 'shopping-cart' },
  events: { color: '#38BDF8', icon: 'event' },
  members: { color: '#FB923C', icon: 'group' },
};

function formatRelativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  if (mins < 48 * 60) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type NotificationInboxProps = {
  initialSegment?: InboxSegment;
  hidePoppinsLaunch?: boolean;
  onClose: () => void;
};

/**
 * Unified household inbox — alerts (synced notifications) + Poppins activity feed.
 * Single surface for bell, settings, and Poppins hourglass entry points.
 */
export function NotificationInbox({
  initialSegment = 'alerts',
  hidePoppinsLaunch = false,
  onClose,
}: NotificationInboxProps) {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const {
    accentTheme,
    dismissInboxItem,
    household,
    inboxBriefing,
    markAllNotificationsRead,
    markNotificationRead,
    metrics,
    notifications,
    poppinsActivityFacts,
    poppinsMonitorActions,
    poppinsWeeklyBriefing,
    refreshNotifications,
    unreadNotificationCount,
  } = useOrbit();

  const [segment, setSegment] = useState<InboxSegment>(initialSegment);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications();
    }, [refreshNotifications])
  );

  const sections = useMemo(
    () =>
      buildInboxSections(
        notifications.filter((item) => !dismissedIds.includes(item.id)),
        inboxBriefing,
        Date.now(),
        { hidePoppinsLaunch }
      ),
    [dismissedIds, hidePoppinsLaunch, inboxBriefing, notifications]
  );

  const attentionCount = useMemo(
    () => needsAttentionCount(sections.flatMap((section) => section.cards)),
    [sections]
  );

  const activityItems = useMemo(() => {
    const fromMonitor: ActivityItem[] = poppinsMonitorActions.map((action) => {
      const cfg = ACTION_CFG[action.kind] ?? ACTION_CFG.notification;
      return {
        id: action.id,
        action: action.label,
        detail: action.detail,
        createdAt: action.createdAt,
        category: action.kind,
        icon: cfg.icon,
        color: cfg.color,
      };
    });
    const fromFacts: ActivityItem[] = poppinsActivityFacts.map((fact) => {
      const mapped = factToActivityItem(fact);
      const cfg = ACTION_CFG[mapped.category] ?? ACTION_CFG.notification;
      return {
        id: mapped.id,
        action: mapped.action,
        detail: mapped.detail,
        createdAt: mapped.createdAt,
        category: mapped.category,
        icon: cfg.icon,
        color: cfg.color,
      };
    });
    return [...fromMonitor, ...fromFacts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }, [poppinsActivityFacts, poppinsMonitorActions]);

  const statusLine =
    segment === 'alerts'
      ? unreadNotificationCount > 0
        ? `${unreadNotificationCount} unread · ${attentionCount} need attention`
        : 'You are caught up'
      : activityItems.length > 0
        ? `${activityItems.length} recent signals`
        : 'Poppins is monitoring quietly';

  const openCard = async (card: SheetNotificationCard) => {
    if (card.source && !card.source.isRead) {
      await markNotificationRead(card.source.id);
    }
    const route = routeForSheetCard(card);
    onClose();
    if (!route) return;
    InteractionManager.runAfterInteractions(() => {
      router.push(route as never);
    });
  };

  const dismissCard = async (card: SheetNotificationCard) => {
    setDismissedIds((current) => [...current, card.id]);
    if (card.source) {
      await dismissInboxItem(card.source.id);
      return;
    }
    if (card.id === 'morning-brief') {
      await dismissInboxItem('morning-brief');
    }
  };

  return (
    <View style={[styles.shell, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>
      <View style={styles.handleRow}>
        <View style={[styles.handle, { backgroundColor: glassBorder(0.22) }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <PageEyebrow>Household</PageEyebrow>
          <Text style={[typography.title2, { color: c.text }]} accessibilityRole="header">
            Inbox
          </Text>
          <Text style={[typography.footnote, { color: c.textMuted }]}>{statusLine}</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: glass(0.08) }]}
          hitSlop={8}
          accessibilityLabel="Close inbox">
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            {
              value: 'alerts' as const,
              label: unreadNotificationCount > 0 ? `Alerts (${unreadNotificationCount})` : 'Alerts',
            },
            { value: 'activity' as const, label: 'Activity' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {segment === 'alerts' && unreadNotificationCount > 0 ? (
        <Pressable
          onPress={() => void markAllNotificationsRead()}
          style={styles.markAllRow}
          hitSlop={8}>
          <MaterialIcons name="done-all" size={15} color={accentTheme.primary} />
          <Text style={[typography.footnote, { color: accentTheme.primary, fontWeight: '700' }]}>
            Mark all read
          </Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[orbitScreen.content, { paddingTop: space.sm, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        {segment === 'alerts' ? (
          <AlertsFeed
            sections={sections}
            onOpen={(card) => void openCard(card)}
            onDismiss={(card) => void dismissCard(card)}
          />
        ) : (
          <ActivityFeed
            items={activityItems}
            metrics={metrics}
            weekly={poppinsWeeklyBriefing}
            taskCompletedFallback={household.tasks.filter((task) => task.status === 'Completed').length}
          />
        )}
      </ScrollView>
    </View>
  );
}

function AlertsFeed({
  onDismiss,
  onOpen,
  sections,
}: {
  onDismiss: (card: SheetNotificationCard) => void;
  onOpen: (card: SheetNotificationCard) => void;
  sections: InboxSection[];
}) {
  const { c } = useOrbitColors();

  if (sections.length === 0) {
    return (
      <EmptyState
        tone="noneYet"
        title="No alerts"
        caption="Household notifications from tasks, plan, groceries, and rewards land here — synced across devices."
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.feed}>
      {sections.map((section) => (
        <SectionBlock key={section.id} color={section.color} count={section.cards.length} label={section.label}>
          {section.cards.map((card) => (
            <AlertCard key={card.id} card={card} onDismiss={onDismiss} onOpen={onOpen} />
          ))}
        </SectionBlock>
      ))}
      <Text style={[typography.caption2, styles.syncNote, { color: c.textFaint }]}>
        Synced with your household · tap to open · swipe away with dismiss
      </Text>
    </Animated.View>
  );
}

function AlertCard({
  card,
  onDismiss,
  onOpen,
}: {
  card: SheetNotificationCard;
  onDismiss: (card: SheetNotificationCard) => void;
  onOpen: (card: SheetNotificationCard) => void;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const unread = Boolean(card.source && !card.source.isRead);
  const route = routeForSheetCard(card);

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(140)}>
      <Pressable
        onPress={() => onOpen(card)}
        style={[
          styles.alertCard,
          {
            backgroundColor: unread ? `${card.color}10` : glass(0.04),
            borderColor: unread ? `${card.color}30` : glassBorder(0.08),
          },
        ]}>
        <View style={styles.alertTop}>
          <View style={styles.alertTitleRow}>
            {card.memberEmoji ? (
              <View style={[styles.alertEmoji, { backgroundColor: `${card.color}16` }]}>
                <Text style={{ fontSize: 14 }}>{card.memberEmoji}</Text>
              </View>
            ) : null}
            <Text
              style={[
                typography.subheadline,
                { color: c.text, fontWeight: unread ? '700' : '600', flex: 1 },
              ]}
              numberOfLines={2}>
              {card.title}
            </Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onDismiss(card);
            }}
            hitSlop={8}
            style={[styles.dismissBtn, { backgroundColor: glass(0.08) }]}
            accessibilityLabel="Dismiss alert">
            <MaterialIcons name="close" size={12} color={c.textSubtle} />
          </Pressable>
        </View>

        {card.body ? (
          <Text style={[typography.footnote, { color: c.textSoft, marginTop: 6 }]} numberOfLines={3}>
            {card.body}
          </Text>
        ) : null}

        {card.bullets?.length ? (
          <View style={styles.bullets}>
            {card.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: card.color }]} />
                <Text style={[typography.footnote, { color: c.textSoft, flex: 1 }]}>{bullet}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.alertMeta}>
          <Text style={[typography.caption2, { color: c.textSubtle }]}>{card.timeLabel}</Text>
          {route ? (
            <Text style={[typography.caption2, { color: card.color, fontWeight: '700' }]}>
              {card.actionLabel ?? 'Open'}
            </Text>
          ) : null}
          {unread ? <View style={[styles.unreadDot, { backgroundColor: card.color }]} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ActivityFeed({
  items,
  metrics,
  taskCompletedFallback,
  weekly,
}: {
  items: ActivityItem[];
  metrics?: OrbitMetrics | null;
  taskCompletedFallback: number;
  weekly: PoppinsWeeklyBriefing;
}) {
  const { c, glass, glassBorder } = useOrbitColors();

  const weekStats = [
    { val: String(weekly.tasksCompleted || taskCompletedFallback), label: 'Managed', emoji: '✅' },
    { val: String(Math.max(0, Math.round((metrics?.upcomingEvents ?? 0) / 2)) || 3), label: 'Trips', emoji: '🗺️' },
    {
      val:
        weekly.momentumChange > 0
          ? `${Math.round(weekly.momentumChange)}m`
          : weekly.xpEarned
            ? `${Math.round(weekly.xpEarned / 10)}m`
            : '2h',
      label: 'Saved',
      emoji: '⏱️',
    },
  ];

  if (items.length === 0) {
    return (
      <View style={styles.feed}>
        <View style={[styles.liveBar, { backgroundColor: 'rgba(45,212,191,0.06)', borderColor: 'rgba(45,212,191,0.16)' }]}>
          <PoppinsHourglass size={16} color="#2DD4BF" active />
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption1, { color: '#2DD4BF', fontWeight: '700' }]}>
              Poppins is active
            </Text>
            <Text style={[typography.caption2, { color: c.textMuted }]}>
              Schedules, streaks, and household patterns are monitored in the background.
            </Text>
          </View>
        </View>
        <EmptyState
          tone="allClear"
          title="No activity yet"
          caption="When Poppins acts — reminders, insights, monitor passes — it shows up here alongside your alerts."
        />
        <WeekSummary stats={weekStats} />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.feed}>
      <View style={[styles.liveBar, { backgroundColor: 'rgba(45,212,191,0.06)', borderColor: 'rgba(45,212,191,0.16)' }]}>
        <PoppinsHourglass size={16} color="#2DD4BF" active />
        <Text style={[typography.caption1, { color: '#2DD4BF', fontWeight: '700' }]}>
          Live household signals
        </Text>
      </View>

      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.activityCard, { backgroundColor: glass(0.04), borderColor: glassBorder(0.08) }]}>
          <View style={[styles.activityIcon, { backgroundColor: `${item.color}16`, borderColor: `${item.color}30` }]}>
            <MaterialIcons name={item.icon} size={16} color={item.color} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.activityMeta}>
              <Text style={[typography.caption1, { color: item.color, fontWeight: '700' }]} numberOfLines={1}>
                {item.action}
              </Text>
              <Text style={[typography.caption2, { color: c.textSubtle }]}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            <Text style={[typography.footnote, { color: c.textSoft }]}>{item.detail}</Text>
          </View>
        </View>
      ))}

      <WeekSummary stats={weekStats} />
    </Animated.View>
  );
}

function WeekSummary({ stats }: { stats: { val: string; label: string; emoji: string }[] }) {
  const { c, glass } = useOrbitColors();
  return (
    <View style={[styles.weekCard, { backgroundColor: 'rgba(45,212,191,0.07)', borderColor: 'rgba(45,212,191,0.18)' }]}>
      <View style={styles.weekHead}>
        <PoppinsHourglass size={13} color="#2DD4BF" active={false} />
        <Text style={styles.weekLabel}>THIS WEEK</Text>
      </View>
      <View style={styles.weekGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.weekStat, { backgroundColor: glass(0.06) }]}>
            <Text style={{ fontSize: 16 }}>{stat.emoji}</Text>
            <Text style={{ color: '#2DD4BF', fontWeight: '800', fontSize: 14 }}>{stat.val}</Text>
            <Text style={[typography.caption2, { color: c.textSubtle }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SectionBlock({
  children,
  color,
  count,
  label,
}: {
  children: ReactNode;
  color: string;
  count: number;
  label: string;
}) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: color }]} />
        <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>{label}</Text>
        <View style={[styles.sectionLine, { backgroundColor: glassBorder(0.08) }]} />
        <Text style={[typography.caption2, { color: c.textSubtle }]}>{count}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  handleRow: { alignItems: 'center', paddingBottom: 4, paddingTop: 10 },
  handle: { borderRadius: 999, height: 4, width: 36 },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerCopy: { flex: 1, gap: 2 },
  closeBtn: {
    alignItems: 'center',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  segmentWrap: { paddingHorizontal: space.md },
  markAllRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  scroll: { flex: 1 },
  feed: { gap: space.lg },
  syncNote: { textAlign: 'center' },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionDot: { borderRadius: 4, height: 8, width: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionBody: { gap: 10, marginTop: 10 },
  alertCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  alertTop: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  alertTitleRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  alertEmoji: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dismissBtn: {
    alignItems: 'center',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  bullets: { gap: 6, marginTop: 8 },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  bulletDot: { borderRadius: 2, height: 4, marginTop: 7, width: 4 },
  alertMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
  unreadDot: { borderRadius: 3, height: 6, marginLeft: 'auto', width: 6 },
  liveBar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  activityCard: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  activityIcon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activityMeta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: space.md,
  },
  weekHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  weekLabel: {
    color: '#2DD4BF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  weekGrid: { flexDirection: 'row', gap: 8 },
  weekStat: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    flex: 1,
    gap: 2,
    paddingVertical: 12,
  },
});

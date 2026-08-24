import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PoppinsHourglass } from '@/components/orbit/poppins-hourglass';
import { AppText as Text } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';
import { getNotificationRoute } from '@/lib/notifications/navigate';
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  BUCKET_ORDER,
  buildSheetNotifications,
  needsAttentionCount,
  type NotifBucket,
} from '@/lib/poppins/notification-buckets';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { factToActivityItem, type HouseholdFact } from '@/lib/poppins/notification-policy';
import type {
  PoppinsBriefing,
  PoppinsMonitorAction,
  PoppinsWeeklyBriefing,
  NotificationItem,
  OrbitMetrics,
} from '@/types/orbit';

type SheetTab = 'notifications' | 'activity';

/** `inbox` = header bell (Notifications + Activity). `activity` = Poppins tab (Activity only). */
export type PoppinsSheetVariant = 'inbox' | 'activity';

type ActivityItem = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  category: string;
  trigger: TriggerKey;
  impact?: string;
  tripLabel?: string;
  /** Deep-link for propose_plan → create-itinerary */
  planDraft?: { title?: string; detail?: string; dayLabel?: string };
};

type TriggerKey = 'gps' | 'pattern' | 'schedule' | 'streak' | 'reward' | 'alert';

const TRIGGER_CFG: Record<TriggerKey, { label: string; color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  gps: { label: 'GPS', color: '#34D399', icon: 'navigation' },
  pattern: { label: 'Pattern', color: '#A78BFA', icon: 'trending-up' },
  schedule: { label: 'Schedule', color: '#38BDF8', icon: 'schedule' },
  streak: { label: 'Streak', color: '#FBBF24', icon: 'bolt' },
  reward: { label: 'Reward', color: '#FB923C', icon: 'emoji-events' },
  alert: { label: 'Alert', color: '#F87171', icon: 'warning' },
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
  xp_fairness: { color: '#FBBF24', icon: 'balance' },
  holiday: { color: '#A78BFA', icon: 'flight' },
  ask_info: { color: '#38BDF8', icon: 'help-outline' },
  monitor: { color: '#06B6D4', icon: 'visibility' },
  notification: { color: '#FB923C', icon: 'notifications' },
  general: { color: '#FB923C', icon: 'notifications' },
  groceries: { color: '#FB923C', icon: 'shopping-cart' },
  events: { color: '#38BDF8', icon: 'event' },
  members: { color: '#FB923C', icon: 'group' },
};

function triggerFor(kind: string): TriggerKey {
  if (kind === 'plan' || kind === 'events' || kind === 'itinerary') return 'gps';
  if (kind === 'deals' || kind === 'ask_info' || kind === 'ai' || kind === 'insight') return 'pattern';
  if (kind === 'xp_fairness' || kind === 'streak') return 'streak';
  if (kind === 'rewards') return 'reward';
  if (kind === 'nudge' || kind === 'holiday') return 'alert';
  return 'schedule';
}

function impactFrom(text: string): string | undefined {
  const xp = text.match(/\+?\d+\s*XP/i);
  if (xp) return xp[0].replace(/\s+/g, ' ');
  const save = text.match(/save[sd]?\s+\d+\s*min/i);
  if (save) return save[0];
  const streak = text.match(/streak\s*\+?\d+/i);
  if (streak) return streak[0];
  return undefined;
}

function timeGroup(iso: string): string {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 15) return 'Now';
  if (mins < 60) return 'This Hour';
  if (mins < 48 * 60) {
    const d = new Date(iso);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (
      d.getDate() === y.getDate() &&
      d.getMonth() === y.getMonth() &&
      d.getFullYear() === y.getFullYear()
    ) {
      return 'Yesterday';
    }
    if (mins < 24 * 60) return 'This Hour';
  }
  return 'Earlier';
}

function formatTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PulsingDot({ color }: { color: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.6, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2.2 - pulse.value,
  }));
  return (
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />
  );
}

function BreathingDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <BreathingDot key={i} color={color} delay={i * 200} />
      ))}
    </View>
  );
}

function BreathingDot({ color, delay }: { color: string; delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    const t = setTimeout(() => {
      o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    }, delay);
    return () => clearTimeout(t);
  }, [delay, o]);
  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: 0.8 + o.value * 0.4 }],
  }));
  return (
    <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />
  );
}

type PoppinsActivitySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Header bell uses `inbox`; Poppins tab uses `activity` only. */
  variant?: PoppinsSheetVariant;
  notifications: NotificationItem[];
  monitorActions: PoppinsMonitorAction[];
  activityFacts?: HouseholdFact[];
  briefing?: PoppinsBriefing | null;
  weekly: PoppinsWeeklyBriefing;
  metrics?: OrbitMetrics | null;
  poppinsActive?: boolean;
  onDismissNotification: (id: string) => void | Promise<void>;
  taskCompletedFallback?: number;
};

export function PoppinsActivitySheet({
  visible,
  onClose,
  variant = 'inbox',
  notifications,
  monitorActions,
  activityFacts = [],
  briefing,
  weekly,
  metrics,
  poppinsActive = true,
  onDismissNotification,
  taskCompletedFallback = 0,
}: PoppinsActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const drive = usePoppinsUiDrive();
  const activityOnly = variant === 'activity';
  const [tab, setTab] = useState<SheetTab>(activityOnly ? 'activity' : 'notifications');
  const [dismissed, setDismissed] = useState<string[]>([]);
  const showingActivity = drive.live || activityOnly || tab === 'activity';

  useEffect(() => {
    if (!visible) return;
    setTab(activityOnly || drive.live ? 'activity' : 'notifications');
  }, [activityOnly, drive.live, visible]);

  const handleRequestClose = () => {
    if (drive.live) poppinsUiOrchestrator.pause();
    onClose();
  };

  const cards = useMemo(
    () =>
      buildSheetNotifications(notifications, briefing).filter(
        (card) => !dismissed.includes(card.id)
      ),
    [briefing, dismissed, notifications]
  );

  const unread = needsAttentionCount(cards);

  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: cards.filter((card) => card.bucket === bucket),
  })).filter((g) => g.items.length > 0);

  const activityItems = useMemo(() => {
    const fromMonitor: ActivityItem[] = monitorActions.map((action) => ({
      id: action.id,
      action: action.label,
      detail: action.detail,
      createdAt: action.createdAt,
      category: action.kind,
      trigger: triggerFor(action.kind),
      impact: impactFrom(`${action.label} ${action.detail}`),
      planDraft:
        action.kind === 'plan'
          ? {
              title: String(action.data?.planTitle ?? action.label),
              detail: String(action.data?.planDetail ?? action.detail),
              dayLabel:
                typeof action.data?.dayLabel === 'string' ? action.data.dayLabel : undefined,
            }
          : undefined,
    }));
    const fromFacts: ActivityItem[] = activityFacts.map((fact) => {
      const mapped = factToActivityItem(fact);
      return {
        id: mapped.id,
        action: mapped.action,
        detail: mapped.detail,
        createdAt: mapped.createdAt,
        category: mapped.category,
        trigger: triggerFor(mapped.category),
        impact: impactFrom(`${mapped.action} ${mapped.detail}`),
      };
    });
    return [...fromMonitor, ...fromFacts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);
  }, [activityFacts, monitorActions]);

  const activityGroups = ['Now', 'This Hour', 'Yesterday', 'Earlier']
    .map((label) => ({
      label,
      items: activityItems.filter((item) => timeGroup(item.createdAt) === label),
    }))
    .filter((g) => g.items.length > 0);

  const weekStats = [
    {
      val: String(weekly.tasksCompleted || taskCompletedFallback),
      label: 'Managed',
      emoji: '✅',
    },
    {
      val: String(Math.max(0, Math.round((metrics?.upcomingEvents ?? 0) / 2)) || 3),
      label: 'Trips',
      emoji: '🗺️',
    },
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
    {
      val: String(
        notifications.filter((n) => n.category === 'tasks' || n.category === 'events').length || 8
      ),
      label: 'Reminders',
      emoji: '🔔',
    },
  ];

  const handleCardAction = async (card: (typeof cards)[number]) => {
    if (card.id === 'morning-brief') {
      onClose();
      return;
    }
    if (card.source) {
      await onDismissNotification(card.source.id);
      const route = getNotificationRoute(card.source);
      onClose();
      if (route) router.push(route as never);
    }
  };

  const handleDismiss = async (card: (typeof cards)[number]) => {
    setDismissed((d) => [...d, card.id]);
    if (card.source) await onDismissNotification(card.source.id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleRequestClose}>
      <Pressable style={styles.backdrop} onPress={handleRequestClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: isDark ? 'rgba(5,8,18,0.98)' : c.cardStrong,
            borderColor: glassBorder(0.1),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}>
        <View style={[styles.handle, { backgroundColor: glassBorder(0.2) }]} />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerIcon,
                {
                  backgroundColor: showingActivity
                    ? 'rgba(45,212,191,0.1)'
                    : 'rgba(248,113,113,0.1)',
                  borderColor: showingActivity
                    ? 'rgba(45,212,191,0.25)'
                    : 'rgba(248,113,113,0.25)',
                },
              ]}>
              {showingActivity ? (
                <PoppinsHourglass size={18} color="#2DD4BF" active={poppinsActive} />
              ) : (
                <MaterialIcons name="notifications" size={16} color="#F87171" />
              )}
            </View>
            <View>
              <Text style={[typography.headline, { color: c.text }]}>
                {drive.live
                  ? 'Poppins'
                  : showingActivity
                    ? 'Poppins Activity'
                    : 'Notifications'}
              </Text>
              <Text style={[typography.caption1, { color: c.textMuted }]}>
                {drive.live
                  ? 'Listening — the act is on the Poppins tab'
                  : showingActivity
                    ? poppinsActive
                      ? 'Poppins is active in the background'
                      : 'All quiet'
                    : unread > 0
                      ? `${unread} need${unread === 1 ? 's' : ''} your attention`
                      : "You're all caught up"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleRequestClose}
            style={[styles.close, { backgroundColor: glass(0.08) }]}>
            <MaterialIcons name="close" size={16} color={c.textMuted} />
          </Pressable>
        </View>

        {!activityOnly && !drive.live ? (
        <View style={[styles.tabs, { backgroundColor: glass(0.05) }]}>
          {(['notifications', 'activity'] as const).map((t) => {
            const active = tab === t;
            const tColor = t === 'notifications' ? '#F87171' : '#2DD4BF';
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabChip,
                  active && {
                    backgroundColor: `${tColor}14`,
                    borderColor: `${tColor}40`,
                  },
                ]}>
                {t === 'notifications' ? (
                  <MaterialIcons
                    name="notifications"
                    size={14}
                    color={active ? '#F87171' : c.textSubtle}
                  />
                ) : (
                  <PoppinsHourglass size={14} color={active ? '#2DD4BF' : c.textSubtle} active={false} />
                )}
                <Text
                  style={[
                    typography.caption1,
                    {
                      color: active ? tColor : c.textSubtle,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {t === 'notifications' ? 'Notifications' : 'Poppins Activity'}
                </Text>
                {t === 'notifications' && unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {!showingActivity ? (
            <Animated.View key="notifs" entering={FadeIn.duration(180)} style={{ gap: 20 }}>
              {groups.length === 0 ? (
                <Text style={[typography.footnote, { color: c.textMuted }]}>
                  No notifications right now.
                </Text>
              ) : (
                groups.map(({ bucket, items }) => (
                  <BucketSection key={bucket} bucket={bucket} count={items.length}>
                    {items.map((card) => (
                      <Animated.View
                        key={card.id}
                        entering={FadeInDown.duration(200)}
                        exiting={FadeOut.duration(160)}
                        style={[
                          styles.card,
                          {
                            backgroundColor: `${card.color}10`,
                            borderColor: `${card.color}28`,
                          },
                        ]}>
                        <View style={styles.cardTop}>
                          <View style={styles.cardTitleRow}>
                            {card.memberEmoji ? (
                              <View
                                style={[
                                  styles.memberEmoji,
                                  {
                                    backgroundColor: `${card.color}18`,
                                    borderColor: `${card.color}30`,
                                  },
                                ]}>
                                <Text style={{ fontSize: 14 }}>{card.memberEmoji}</Text>
                              </View>
                            ) : null}
                            <Text
                              style={[typography.subheadline, { color: c.text, fontWeight: '600', flex: 1 }]}>
                              {card.title}
                            </Text>
                          </View>
                          <View style={styles.cardMeta}>
                            <Text style={[typography.caption2, { color: c.textSubtle }]}>
                              {card.timeLabel}
                            </Text>
                            <Pressable
                              onPress={() => void handleDismiss(card)}
                              style={[styles.dismiss, { backgroundColor: glass(0.08) }]}>
                              <MaterialIcons name="close" size={12} color={c.textSubtle} />
                            </Pressable>
                          </View>
                        </View>
                        {card.body ? (
                          <Text style={[typography.footnote, { color: c.textSoft, marginTop: 6 }]}>
                            {card.body}
                          </Text>
                        ) : null}
                        {card.bullets?.length ? (
                          <View style={styles.bullets}>
                            {card.bullets.map((b) => (
                              <View key={b} style={styles.bulletRow}>
                                <View
                                  style={[styles.bulletDot, { backgroundColor: card.color }]}
                                />
                                <Text style={[typography.footnote, { color: c.textSoft, flex: 1 }]}>
                                  {b}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {card.actionLabel ? (
                          <Pressable
                            onPress={() => void handleCardAction(card)}
                            style={[
                              styles.cta,
                              {
                                backgroundColor: `${card.color}18`,
                                borderColor: `${card.color}40`,
                              },
                            ]}>
                            <Text style={{ color: card.color, fontWeight: '700', fontSize: 12 }}>
                              {card.actionLabel}
                            </Text>
                          </Pressable>
                        ) : null}
                      </Animated.View>
                    ))}
                  </BucketSection>
                ))
              )}
            </Animated.View>
          ) : (
            <Animated.View key="activity" entering={FadeIn.duration(180)} style={{ gap: 18 }}>
              <View
                style={[
                  styles.liveBar,
                  {
                    backgroundColor: 'rgba(45,212,191,0.06)',
                    borderColor: 'rgba(45,212,191,0.16)',
                  },
                ]}>
                <PoppinsHourglass size={16} color="#2DD4BF" active={poppinsActive} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption1, { color: '#2DD4BF', fontWeight: '700' }]}>
                    Poppins is active
                  </Text>
                  <Text style={[typography.caption2, { color: c.textMuted, lineHeight: 16 }]}>
                    Monitoring schedules, GPS patterns, streaks & rewards in the background
                  </Text>
                </View>
                <BreathingDots color="#2DD4BF" />
              </View>

              {activityGroups.length === 0 ? (
                <Text style={[typography.footnote, { color: c.textMuted }]}>
                  Poppins hasn&apos;t logged activity yet.
                </Text>
              ) : (
                activityGroups.map(({ label, items }) => (
                  <View key={label} style={{ gap: 10 }}>
                    <View style={styles.sectionHead}>
                      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>
                        {label.toUpperCase()}
                      </Text>
                      <View style={[styles.sectionLine, { backgroundColor: glassBorder(0.08) }]} />
                    </View>
                    {items.map((item) => {
                      const cfg = ACTION_CFG[item.category] ?? ACTION_CFG.notification;
                      const trig = TRIGGER_CFG[item.trigger];
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.card,
                            {
                              backgroundColor: glass(0.04),
                              borderColor: glassBorder(0.08),
                            },
                          ]}>
                          <View style={styles.activityRow}>
                            <View
                              style={[
                                styles.activityIcon,
                                {
                                  backgroundColor: `${cfg.color}18`,
                                  borderColor: `${cfg.color}30`,
                                },
                              ]}>
                              <MaterialIcons name={cfg.icon} size={16} color={cfg.color} />
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                              <View style={styles.activityMeta}>
                                <Text
                                  style={[typography.caption1, { color: cfg.color, fontWeight: '700' }]}
                                  numberOfLines={1}>
                                  {item.action}
                                </Text>
                                <View
                                  style={[
                                    styles.trigger,
                                    {
                                      backgroundColor: `${trig.color}14`,
                                      borderColor: `${trig.color}33`,
                                    },
                                  ]}>
                                  <MaterialIcons name={trig.icon} size={10} color={trig.color} />
                                  <Text
                                    style={{
                                      fontSize: 9,
                                      color: trig.color,
                                      fontWeight: '700',
                                      letterSpacing: 0.3,
                                    }}>
                                    {trig.label}
                                  </Text>
                                </View>
                                <Text style={[typography.caption2, { color: c.textSubtle }]}>
                                  {formatTime(item.createdAt)}
                                </Text>
                              </View>
                              <Text style={[typography.footnote, { color: c.textSoft }]}>
                                {item.detail}
                              </Text>
                              {item.planDraft ? (
                                <Pressable
                                  onPress={() => {
                                    onClose();
                                    router.push({
                                      pathname: '/create-itinerary',
                                      params: {
                                        title: item.planDraft?.title ?? '',
                                        detail: item.planDraft?.detail ?? '',
                                        dayLabel: item.planDraft?.dayLabel ?? '',
                                      },
                                    } as never);
                                  }}
                                  style={[
                                    styles.reviewBtn,
                                    { backgroundColor: `${cfg.color}22`, borderColor: `${cfg.color}44` },
                                  ]}>
                                  <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 12 }}>
                                    Review in Plan
                                  </Text>
                                  <MaterialIcons name="arrow-forward" size={14} color={cfg.color} />
                                </Pressable>
                              ) : null}
                              <View style={styles.pills}>
                                {item.impact ? (
                                  <View
                                    style={[
                                      styles.pill,
                                      { backgroundColor: `${cfg.color}14` },
                                    ]}>
                                    <Text
                                      style={{ fontSize: 10, color: cfg.color, fontWeight: '600' }}>
                                      {item.impact}
                                    </Text>
                                  </View>
                                ) : null}
                                {item.tripLabel ? (
                                  <View
                                    style={[
                                      styles.pill,
                                      { backgroundColor: 'rgba(56,189,248,0.12)' },
                                    ]}>
                                    <MaterialIcons name="place" size={10} color="#38BDF8" />
                                    <Text
                                      style={{ fontSize: 10, color: '#38BDF8', fontWeight: '600' }}>
                                      {item.tripLabel}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}

              <View
                style={[
                  styles.weekCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(45,212,191,0.07)'
                      : 'rgba(45,212,191,0.08)',
                    borderColor: 'rgba(45,212,191,0.18)',
                  },
                ]}>
                <View style={styles.weekHead}>
                  <PoppinsHourglass size={13} color="#2DD4BF" />
                  <Text style={styles.weekLabel}>THIS WEEK</Text>
                </View>
                <View style={styles.weekGrid}>
                  {weekStats.map((stat) => (
                    <View
                      key={stat.label}
                      style={[
                        styles.weekStat,
                        { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : glass(0.06) },
                      ]}>
                      <Text style={{ fontSize: 16 }}>{stat.emoji}</Text>
                      <Text style={{ color: '#2DD4BF', fontWeight: '800', fontSize: 14 }}>
                        {stat.val}
                      </Text>
                      <Text style={[typography.caption2, { color: c.textSubtle }]}>
                        {stat.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function BucketSection({
  bucket,
  count,
  children,
}: {
  bucket: NotifBucket;
  count: number;
  children: ReactNode;
}) {
  const { c, glassBorder } = useOrbitColors();
  const color = BUCKET_COLORS[bucket];
  return (
    <View>
      <View style={styles.sectionHead}>
        {bucket === 'critical' ? <PulsingDot color={color} /> : (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        )}
        <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>
          {BUCKET_LABELS[bucket]}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: glassBorder(0.08) }]} />
        <Text style={[typography.caption2, { color: c.textSubtle }]}>{count}</Text>
      </View>
      <View style={{ gap: 10, marginTop: 10 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '91%',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    marginHorizontal: space.md,
    marginBottom: 10,
    borderRadius: 16,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  tabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  scroll: { flexGrow: 0 },
  stageLive: {
    minHeight: 420,
    paddingHorizontal: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  content: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  card: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  memberEmoji: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dismiss: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullets: { marginTop: 8, gap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, marginTop: 7 },
  cta: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityRow: { flexDirection: 'row', gap: 12 },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  weekCard: {
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 12,
  },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekLabel: {
    fontSize: 10,
    color: '#2DD4BF',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  weekGrid: { flexDirection: 'row', gap: 8 },
  weekStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    borderRadius: 14,
  },
});

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { InteractionManager, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  BUCKET_ORDER,
  buildSheetNotifications,
  needsAttentionCount,
  routeForSheetCard,
  type NotifBucket,
} from '@/lib/poppins/notification-buckets';
import { poppinsUiOrchestrator, usePoppinsUiDrive } from '@/lib/poppins/ui-orchestrator';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { PoppinsBriefing, NotificationItem } from '@/types/orbit';

type PoppinsActivitySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Briefing must not launch Poppins while already on that tab. */
  hidePoppinsLaunch?: boolean;
  notifications: NotificationItem[];
  briefing?: PoppinsBriefing | null;
  onDismissNotification: (id: string) => void | Promise<void>;
};

export function PoppinsActivitySheet({
  visible,
  onClose,
  hidePoppinsLaunch = false,
  notifications,
  briefing,
  onDismissNotification,
}: PoppinsActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const { c, isDark, glass, glassBorder } = useOrbitColors();
  const drive = usePoppinsUiDrive();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const handleRequestClose = () => {
    if (drive.live) poppinsUiOrchestrator.pause();
    onClose();
  };

  const cards = useMemo(
    () =>
      buildSheetNotifications(notifications, briefing, Date.now(), { hidePoppinsLaunch }).filter(
        (card) => !dismissed.includes(card.id)
      ),
    [briefing, dismissed, hidePoppinsLaunch, notifications]
  );

  const unread = needsAttentionCount(cards);

  const groups = BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: cards.filter((card) => card.bucket === bucket),
  })).filter((g) => g.items.length > 0);

  const handleCardAction = async (card: (typeof cards)[number]) => {
    const route = routeForSheetCard(card);
    if (card.source) await onDismissNotification(card.source.id);
    onClose();
    if (!route) return;
    InteractionManager.runAfterInteractions(() => {
      router.push(route as never);
    });
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
                  backgroundColor: 'rgba(248,113,113,0.1)',
                  borderColor: 'rgba(248,113,113,0.25)',
                },
              ]}>
              <MaterialIcons name="notifications" size={16} color="#F87171" />
            </View>
            <View>
              <Text style={[typography.headline, { color: c.text }]}>Notifications</Text>
              <Text style={[typography.caption1, { color: c.textMuted }]}>
                {unread > 0
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

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
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
                              <View style={[styles.bulletDot, { backgroundColor: card.color }]} />
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
                          accessibilityRole="button"
                          accessibilityLabel={card.actionLabel}
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
  const { c } = useOrbitColors();
  const color = BUCKET_COLORS[bucket];
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color }]}>
          {BUCKET_LABELS[bucket]} · {count}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: c.border }]} />
      </View>
      {children}
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
  scroll: { flexGrow: 0 },
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
});

/**
 * Root-level “Replay a part” sheet — frosted chapter picker.
 * Opens only after Settings has dismissed (never nests under Expo modal).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { FrostedPanel, frostedBackdropColor } from '@/components/orbit/frosted-panel';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { radius, space, typography } from '@/constants/orbit-theme';
import { resolveTourId } from '@/lib/tour/tour-conditions';
import { presentTourChapters } from '@/lib/tour/tour-chapter-meta';
import { chaptersForTour } from '@/lib/tour/tour-steps';
import { SESSION_NAV_DELAY_MS } from '@/lib/navigation/session-restart';
import {
  closeTourChapterSheet,
  subscribeTourChapterSheet,
} from '@/lib/ui/tour-chapter-sheet-controller';
import { glassBorder, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type PendingAction = (() => void) | null;

function frostedGroupFill(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.04)';
}

export function TourChapterSheetHost() {
  const [visible, setVisible] = useState(false);
  const pendingAction = useRef<PendingAction>(null);
  const flushedRef = useRef(false);
  const { c, isDark } = useOrbitColors();
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const tour = useTourControls();
  const primary = orbit?.accentTheme.primary ?? c.primary;
  const hairline = glassBorder(isDark, 0.12);
  const pressedFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)';

  const chapters = useMemo(() => {
    if (!orbit) return [];
    const tid = resolveTourId({
      household: orbit.household,
      currentMember: orbit.currentMember,
    });
    return presentTourChapters(chaptersForTour(tid));
  }, [orbit]);

  const tourId = useMemo(() => {
    if (!orbit) return 'admin' as const;
    return resolveTourId({
      household: orbit.household,
      currentMember: orbit.currentMember,
    });
  }, [orbit]);

  useEffect(() => subscribeTourChapterSheet(setVisible), []);

  const flushAfterDismiss = useCallback(() => {
    if (flushedRef.current) return;
    flushedRef.current = true;
    const next = pendingAction.current;
    pendingAction.current = null;
    if (!next) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          next();
        } catch (error) {
          console.warn('tourChapterSheet.action', error);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (visible) {
      flushedRef.current = false;
      return;
    }
    const handle = setTimeout(flushAfterDismiss, SESSION_NAV_DELAY_MS);
    return () => clearTimeout(handle);
  }, [visible, flushAfterDismiss]);

  const beginDismiss = useCallback((action?: () => void) => {
    pendingAction.current = action ?? null;
    flushedRef.current = false;
    closeTourChapterSheet();
  }, []);

  const dismiss = () => beginDismiss(undefined);

  const pickChapter = (chapterId: string) => {
    beginDismiss(() => {
      tour?.startChapter(tourId, chapterId);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={dismiss}
      onDismiss={flushAfterDismiss}>
      <View style={styles.frame}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: frostedBackdropColor(isDark) }]}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss chapter picker">
          <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill} />
        </Pressable>
        <View
          style={[styles.center, { paddingBottom: Math.max(insets.bottom, space.md) + space.xs }]}
          pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(260).springify().damping(18)}
            style={styles.stack}>
            <FrostedPanel borderColor={hairline}>
              <LinearGradient
                colors={[`${primary}18`, 'transparent']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.55 }}
                style={styles.sheetWash}
                pointerEvents="none"
              />
              <View style={styles.sheetInner}>
                <View style={styles.heading}>
                  <View style={[styles.badge, { backgroundColor: `${primary}22` }]}>
                    <MaterialIcons name="replay" size={18} color={primary} />
                  </View>
                  <Text style={[typography.title3, { color: c.text }]}>Replay a part</Text>
                  <Text style={[typography.footnote, { color: c.textMuted, textAlign: 'center' }]}>
                    Jump to one chapter. Settings closes first so the tour can land cleanly.
                  </Text>
                </View>

                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={chapters.length > 5}>
                  <View
                    style={[
                      styles.group,
                      { backgroundColor: frostedGroupFill(isDark), borderColor: hairline },
                    ]}>
                    {chapters.length === 0 ? (
                      <Text style={[styles.empty, { color: c.textMuted }]}>
                        No chapters for this profile yet.
                      </Text>
                    ) : (
                      chapters.map((ch, index) => (
                        <View key={ch.id}>
                          {index > 0 ? (
                            <View style={[styles.separator, { backgroundColor: hairline }]} />
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Replay ${ch.name}`}
                            accessibilityHint={ch.subtitle}
                            onPress={() => pickChapter(ch.id)}
                            style={({ pressed }) => [
                              styles.row,
                              pressed && { backgroundColor: pressedFill },
                            ]}>
                            <View style={[styles.iconWell, { backgroundColor: `${ch.tone}22` }]}>
                              <MaterialIcons name={ch.icon} size={18} color={ch.tone} />
                            </View>
                            <View style={styles.rowCopy}>
                              <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
                                {ch.name}
                              </Text>
                              <Text
                                style={[styles.rowSub, { color: c.textMuted }]}
                                numberOfLines={2}>
                                {ch.subtitle}
                              </Text>
                            </View>
                            <MaterialIcons name="play-arrow" size={22} color={ch.tone} />
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
            </FrostedPanel>

            <FrostedPanel borderColor={hairline}>
              <Pressable
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [
                  styles.cancelRow,
                  pressed && { backgroundColor: pressedFill },
                ]}>
                <Text style={[styles.cancelLabel, { color: c.text }]}>Cancel</Text>
              </Pressable>
            </FrostedPanel>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  center: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space.md,
  },
  stack: {
    alignSelf: 'center',
    gap: 10,
    maxWidth: 420,
    width: '100%',
  },
  sheetWash: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.cardLarge,
  },
  sheetInner: {
    gap: 14,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
  },
  heading: { alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  badge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    marginBottom: 2,
    width: 36,
  },
  scroll: { maxHeight: 360 },
  scrollContent: { paddingBottom: 2 },
  group: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconWell: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, fontWeight: '500', lineHeight: 16 },
  empty: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 20,
    textAlign: 'center',
  },
  cancelRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 14,
  },
  cancelLabel: { fontSize: 17, fontWeight: '700' },
});

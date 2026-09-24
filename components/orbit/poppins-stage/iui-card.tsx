/**
 * WO12 §A2 — the shell every stage scene renders inside.
 * Folds the old stepper kicker + hold ring into one card.
 * Rule: a card never contains a card.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE, stageBorder, stageFaint, stageMuted, stageSurfaces } from '@/constants/iui-stage';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Domain TEXT colour from stageAccent(..., isDark). */
  accent: string;
  /** Fill / ring / dot — stageFill(...). Defaults to accent. */
  fillAccent?: string;
  /** Caps domain label, e.g. GROCERIES. */
  kicker: string;
  /** Optional right-hand count, e.g. "3 items". */
  countLabel?: string;
  /** Hold armed — shows accent ring + footer progress. */
  holding?: boolean;
  holdProgress?: number;
  frozen?: boolean;
  /** Show the hold footer (even before progress starts). */
  hold?: boolean;
  leftFooter?: string;
  rightFooter?: string;
  children: ReactNode;
  accessibilityLabel?: string;
  /** Cap body scroll; defaults to window-aware height. */
  maxBodyHeight?: number;
};

export function IuiCard({
  accent,
  fillAccent,
  kicker,
  countLabel,
  holding = false,
  holdProgress = 0,
  frozen = false,
  hold = false,
  leftFooter,
  rightFooter,
  children,
  accessibilityLabel,
  maxBodyHeight,
}: Props) {
  const { isDark } = useOrbitColors();
  const surfaces = stageSurfaces(isDark);
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const fill = fillAccent ?? accent;
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bodyCap =
    maxBodyHeight ??
    Math.max(220, Math.min(520, windowH - insets.top - insets.bottom - 16 - 220));
  const scale = useSharedValue(1);
  const ringOpacity = useSharedValue(holding ? 1 : 0);
  const enterOpacity = useSharedValue(1);
  const enterY = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Card must be visible immediately (blank-stage bug). Soft settle only if motion is on.
    if (reduceMotion) {
      enterOpacity.value = 1;
      enterY.value = 0;
      return;
    }
    enterOpacity.value = 0.92;
    enterY.value = 6;
    const dur = motionDuration.smooth;
    enterOpacity.value = withTiming(1, {
      duration: dur,
      easing: Easing.out(Easing.cubic),
    });
    enterY.value = withTiming(0, {
      duration: dur,
      easing: Easing.out(Easing.cubic),
    });
  }, [enterOpacity, enterY, reduceMotion]);

  useEffect(() => {
    if (frozen) return;
    if (holding) {
      if (reduceMotion) {
        scale.value = withTiming(1, { duration: motionDuration.snappy });
      } else {
        scale.value = withRepeat(withSpring(1.045, motion.snappy), -1, true);
      }
      ringOpacity.value = withTiming(1, { duration: motionDuration.snappy });
    } else {
      scale.value = withSpring(1, motion.snappy);
      ringOpacity.value = withTiming(hold ? 0.45 : 0, {
        duration: motionDuration.snappy,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [frozen, holding, hold, scale, ringOpacity, reduceMotion]);

  const breath = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: scale.value }, { translateY: enterY.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: fill,
    opacity: ringOpacity.value,
  }));
  const p = Math.min(1, Math.max(0, holdProgress));
  const showFooter = hold || holding;

  return (
    <Animated.View
      accessible
      accessibilityRole="summary"
      style={[styles.wrap, breath]}
      accessibilityViewIsModal={holding || undefined}
      accessibilityLabel={accessibilityLabel ?? kicker}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderRadius: STAGE.radius.ring,
            borderWidth: STAGE.ringWidth,
            padding: 5,
          },
          ringStyle,
        ]}
        pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: surfaces.card,
              borderColor: stageBorder(isDark),
              borderRadius: STAGE.radius.card,
            },
          ]}>
          <View style={styles.kickerRow}>
            <View style={[styles.domainDot, { backgroundColor: fill }]} />
            <Text style={[styles.kicker, { color: accent }]} numberOfLines={1}>
              {kicker.toUpperCase()}
            </Text>
            {countLabel ? (
              <Text style={[styles.count, { color: faint }]} numberOfLines={1}>
                {countLabel}
              </Text>
            ) : (
              <View style={styles.countSpacer} />
            )}
          </View>

          <ScrollView
            style={[styles.bodyScroll, { maxHeight: bodyCap }]}
            contentContainerStyle={styles.body}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>

          {showFooter ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.08)' },
              ]}>
              <View
                style={[
                  styles.holdTrack,
                  { backgroundColor: stageBorder(isDark) },
                ]}>
                <View
                  style={[
                    styles.holdFill,
                    { width: `${p * 100}%`, backgroundColor: fill },
                  ]}
                />
              </View>
              <View style={styles.footerLabels}>
                <Text style={[styles.footerLeft, { color: muted }]} numberOfLines={1}>
                  {leftFooter ?? (holding ? 'Holding…' : 'One hold')}
                </Text>
                <Text style={[styles.footerRight, { color: faint }]} numberOfLines={1}>
                  {rightFooter ?? ''}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  ring: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 8,
  },
  domainDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  kicker: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  count: {
    fontSize: 12,
    fontWeight: '500',
  },
  countSpacer: { width: 8 },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 10,
    paddingBottom: 6,
    gap: 3,
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  holdTrack: {
    height: 3,
    borderRadius: STAGE.radius.pill,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  holdFill: {
    height: 3,
    borderRadius: STAGE.radius.pill,
  },
  footerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerLeft: { fontSize: 12, flexShrink: 1 },
  footerRight: { fontSize: 12, flexShrink: 1, textAlign: 'right' },
});

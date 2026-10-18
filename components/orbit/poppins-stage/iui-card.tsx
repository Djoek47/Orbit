/**
 * The shell every stage scene renders inside: kicker row, body, optional hold footer.
 * Rule: a card never contains a card.
 *
 * The hold ring is a HALO drawn beside the card, never its container. It used to wrap
 * the card, so its opacity (0 unless holding) hid every card that was waiting for input —
 * the "blank stage". The card itself is always fully opaque; only the halo fades.
 *
 * The body does not scroll on its own. The Poppins screen scrolls the whole stage as one
 * unit, bounded above the dock, so a nested scroll can never steal a tap.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE, stageBorder, stageFaint, stageMuted, stageSurfaces } from '@/constants/iui-stage';
import { motion, motionDuration } from '@/constants/motion-tokens';
import { haloOpacity } from '@/lib/poppins/stage-scene';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  /** Domain TEXT colour from stageAccent(..., isDark). */
  accent: string;
  /** Fill / ring / dot — stageFill(...). Defaults to accent. */
  fillAccent?: string;
  /** Caps domain label, e.g. GROCERIES. */
  kicker: string;
  /** Optional right-hand count, e.g. "3 items". */
  countLabel?: string;
  /** Hold running — full halo, gentle breath, footer progress. */
  holding?: boolean;
  holdProgress?: number;
  frozen?: boolean;
  /** Hold armed — faint halo and the footer track, before progress starts. */
  hold?: boolean;
  leftFooter?: string;
  rightFooter?: string;
  children: ReactNode;
  accessibilityLabel?: string;
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
}: Props) {
  const { isDark } = useOrbitColors();
  const surfaces = stageSurfaces(isDark);
  const muted = stageMuted(isDark);
  const faint = stageFaint(isDark);
  const fill = fillAccent ?? accent;
  const scale = useSharedValue(1);
  const halo = useSharedValue(haloOpacity({ hold, holding }));
  const enterOpacity = useSharedValue(1);
  const enterY = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Never start invisible: a soft settle from 0.92, only when motion is on.
    if (reduceMotion) {
      enterOpacity.value = 1;
      enterY.value = 0;
      return;
    }
    enterOpacity.value = 0.92;
    enterY.value = 6;
    const easing = Easing.out(Easing.cubic);
    enterOpacity.value = withTiming(1, { duration: motionDuration.smooth, easing });
    enterY.value = withTiming(0, { duration: motionDuration.smooth, easing });
  }, [enterOpacity, enterY, reduceMotion]);

  useEffect(() => {
    if (frozen) return;
    if (holding && !reduceMotion) {
      scale.value = withRepeat(withSpring(1.02, motion.snappy), -1, true);
    } else {
      scale.value = withSpring(1, motion.snappy);
    }
    halo.value = withTiming(haloOpacity({ hold, holding }), {
      duration: motionDuration.snappy,
      easing: Easing.out(Easing.cubic),
    });
  }, [frozen, holding, hold, scale, halo, reduceMotion]);

  const cardMotion = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: scale.value }, { translateY: enterY.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  const p = Math.min(1, Math.max(0, holdProgress));
  const showFooter = hold || holding;

  return (
    <Animated.View
      accessible={false}
      style={[styles.wrap, cardMotion]}
      accessibilityLabel={accessibilityLabel ?? kicker}>
      <View style={styles.frame}>
        {/* Halo: a sibling overlay. Its opacity never reaches the card. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderColor: fill,
              borderRadius: STAGE.radius.ring,
              borderWidth: STAGE.ringWidth,
            },
            haloStyle,
          ]}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: surfaces.card,
              borderColor: stageBorder(isDark),
              borderRadius: STAGE.radius.card,
            },
          ]}>
          <View style={styles.kickerRow} accessible accessibilityRole="header">
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

          <View style={styles.body}>{children}</View>

          {showFooter ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.08)' },
              ]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={leftFooter ?? (holding ? 'Holding' : 'One hold')}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
              <View style={[styles.holdTrack, { backgroundColor: stageBorder(isDark) }]}>
                <View style={[styles.holdFill, { width: `${p * 100}%`, backgroundColor: fill }]} />
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
      </View>
    </Animated.View>
  );
}

const HALO_GAP = 5;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: 360,
    padding: HALO_GAP,
  },
  halo: {
    ...StyleSheet.absoluteFill,
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

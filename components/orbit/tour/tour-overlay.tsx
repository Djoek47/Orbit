import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TourCard } from '@/components/orbit/tour/tour-card';
import type { TourRect } from '@/lib/tour/tour-types';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Props = {
  target: TourRect | null;
  chapterName: string;
  title: string;
  body: string;
  stepLabel: string;
  isAction: boolean;
  isLast: boolean;
  cardRef?: React.RefObject<View | null>;
  onNext: () => void;
  onSkipChapter: () => void;
  onSkipStep: () => void;
  onClose: () => void;
};

const PAD = 8;
const DEFAULT_RADIUS = 16;

export function TourOverlay({
  target,
  chapterName,
  title,
  body,
  stepLabel,
  isAction,
  isLast,
  cardRef,
  onNext,
  onSkipChapter,
  onSkipStep,
  onClose,
}: Props) {
  const { isDark } = useOrbitColors();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [viewport, setViewport] = useState({ w: 1, h: 1 });

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const r = useSharedValue(DEFAULT_RADIUS);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!target) return;
    const next = {
      x: Math.max(0, target.x - PAD),
      y: Math.max(0, target.y - PAD),
      w: target.width + PAD * 2,
      h: target.height + PAD * 2,
    };
    const duration = reduceMotion ? 0 : 280;
    const easing = Easing.out(Easing.cubic);
    x.value = withTiming(next.x, { duration, easing });
    y.value = withTiming(next.y, { duration, easing });
    w.value = withTiming(next.w, { duration, easing });
    h.value = withTiming(next.h, { duration, easing });
  }, [target, reduceMotion, x, y, w, h]);

  const animatedProps = useAnimatedProps(() => ({
    x: x.value,
    y: y.value,
    width: w.value,
    height: h.value,
    rx: r.value,
    ry: r.value,
  }));

  const dim = isDark ? 0.7 : 0.62;
  const cutout = target
    ? {
        top: target.y - PAD,
        bottom: target.y + target.height + PAD,
        midY: target.y + target.height / 2,
      }
    : null;

  const placeBelow =
    cutout == null || cutout.bottom + 220 < viewport.h - insets.bottom
      ? true
      : cutout.top > 220 + insets.top;

  const cardTop = cutout
    ? placeBelow
      ? cutout.bottom + 12
      : Math.max(insets.top + 8, cutout.top - 200)
    : insets.top + 80;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) =>
        setViewport({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents={isAction ? 'box-none' : 'auto'}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="tourCutout">
              <Rect x={0} y={0} width="100%" height="100%" fill="#fff" />
              {target ? (
                <AnimatedRect animatedProps={animatedProps} fill="#000" />
              ) : null}
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width="100%"
            height="100%"
            fill={`rgba(0,0,0,${dim})`}
            mask="url(#tourCutout)"
          />
        </Svg>
        {/* Block backdrop taps except through the cutout on action steps */}
        {!isAction ? <View style={StyleSheet.absoluteFill} pointerEvents="auto" /> : null}
        {isAction && target ? (
          <>
            <View
              pointerEvents="auto"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, target.y - PAD) }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: target.y + target.height + PAD,
                bottom: 0,
              }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: 0,
                width: Math.max(0, target.x - PAD),
                top: target.y - PAD,
                height: target.height + PAD * 2,
              }}
            />
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute',
                left: target.x + target.width + PAD,
                right: 0,
                top: target.y - PAD,
                height: target.height + PAD * 2,
              }}
            />
          </>
        ) : null}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.cardSlot,
          {
            top: cardTop,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 12,
          },
        ]}>
        <TourCard
          chapterName={chapterName}
          title={title}
          body={body}
          stepLabel={stepLabel}
          isAction={isAction}
          isLast={isLast}
          cardRef={cardRef}
          onNext={onNext}
          onSkipChapter={onSkipChapter}
          onSkipStep={onSkipStep}
          onClose={onClose}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardSlot: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
});

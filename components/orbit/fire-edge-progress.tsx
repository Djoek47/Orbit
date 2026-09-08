import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

type FireEdgeProgressProps = {
  progress: number; // 0–1
  radius?: number;
  strokeWidth?: number;
  style?: ViewStyle;
  children: React.ReactNode;
};

/**
 * Progress stroke around a card. Size follows children — never minHeight-locks
 * leftover empty space when the task list shrinks.
 */
export function FireEdgeProgress({
  progress,
  radius = 24,
  strokeWidth = 3,
  style,
  children,
}: FireEdgeProgressProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const clamped = Math.max(0, Math.min(1, progress));
  const perimeter = 2 * (box.width + box.height - 2 * radius) + 2 * Math.PI * radius;
  const dash = Math.max(1, perimeter * clamped);
  const gap = Math.max(1, perimeter - dash);
  const pulse = useSharedValue(1);
  const full = clamped >= 0.999;

  useEffect(() => {
    if (full) {
      pulse.value = withRepeat(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
    }
  }, [full, pulse]);

  const glowProps = useAnimatedProps(() => ({
    strokeOpacity: full ? 0.55 + (pulse.value - 1) * 2 : 0.35,
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) {
      setBox({ width, height });
    }
  };

  return (
    <View onLayout={onLayout} style={[{ alignSelf: 'stretch', borderRadius: radius }, style]}>
      <View style={[styles.inner, { borderRadius: radius }]}>{children}</View>
      {box.width >= 8 && box.height >= 8 ? (
        <View pointerEvents="none" style={styles.svg}>
          <Svg width={box.width} height={box.height}>
          <Defs>
            <SvgGradient id="fireStroke" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FB923C" stopOpacity="1" />
              <Stop offset="45%" stopColor="#FBBF24" stopOpacity="1" />
              <Stop offset="100%" stopColor={full ? '#F87171' : '#F59E0B'} stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <Rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={box.width - strokeWidth}
            height={box.height - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <AnimatedRect
            animatedProps={glowProps}
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={box.width - strokeWidth}
            height={box.height - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke="url(#fireStroke)"
            strokeWidth={full ? strokeWidth + 1.5 : strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
          />
        </Svg>
        </View>
      ) : null}
      {full ? <View style={[styles.fieryGlow, { borderRadius: radius }]} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
    width: '100%',
  },
  svg: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  fieryGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251,146,60,0.08)',
    borderColor: 'rgba(251,191,36,0.35)',
    borderWidth: 1,
  },
});

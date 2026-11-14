import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const COUNT = 38;

function WaveBar({
  index,
  active,
  color,
  levelNorm,
}: {
  index: number;
  active: boolean;
  color: string;
  /** 0..1 from metering / timer fallback. */
  levelNorm: number;
}) {
  const height = useSharedValue(3);
  const opacity = useSharedValue(0.18);
  const center = COUNT / 2;
  const distFromCenter = Math.abs(index - center) / center;
  const baseH = Math.max(4, (1 - distFromCenter * 0.7) * 36 * (0.45 + levelNorm * 0.7));
  const delay = (index / COUNT) * 400;
  const duration = 350 + (index % 5) * 70;

  useEffect(() => {
    if (active) {
      height.value = withDelay(
        delay,
        withRepeat(
          withTiming(baseH * (0.8 + Math.sin(index * 0.7) * 0.4), {
            duration,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        )
      );
      opacity.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true)
      );
    } else {
      height.value = withTiming(3, { duration: 400 });
      opacity.value = withTiming(0.18, { duration: 400 });
    }
  }, [active, baseH, delay, duration, height, index, opacity]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    backgroundColor: active ? color : 'rgba(255,255,255,0.12)',
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

function normalizeDb(db: number | null | undefined): number {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0.55;
  // expo-audio metering is typically around -60..0 dB.
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

/** Make PoppinsScreen waveform — 38 center-weighted bars. Optional level from Quiet metering. */
export function PoppinsWaveform({
  active,
  color,
  levelDb,
}: {
  active: boolean;
  color: string;
  levelDb?: number | null;
}) {
  const levelNorm = normalizeDb(levelDb);
  return (
    <View style={styles.row}>
      {Array.from({ length: COUNT }, (_, i) => (
        <WaveBar key={i} index={i} active={active} color={color} levelNorm={levelNorm} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  bar: {
    borderRadius: 2,
    width: 3,
  },
});

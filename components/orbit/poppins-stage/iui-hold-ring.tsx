import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  progress: number;
  accent: string;
  frozen?: boolean;
};

/** Silence completes. Speech cancels. Tap is fallback. */
export function IuiHoldRing({ progress, accent, frozen }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(frozen ? p.value : progress, {
      duration: 120,
      easing: Easing.linear,
    });
  }, [p, progress, frozen]);

  const fill = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, p.value * 100))}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor: `${accent}22` }]}>
      <Animated.View style={[styles.fill, { backgroundColor: accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    width: '64%',
    alignSelf: 'center',
    marginTop: 18,
  },
  fill: {
    height: 3,
    borderRadius: 999,
  },
});

/**
 * The paywall's life: stars that twinkle and drift, and the house mark floating in a halo.
 * Shared by every gate — the admin paywall and the paused screen on children's devices.
 */
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

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { useOrbit } from '@/store/orbit-store';

/** Four small stars that twinkle and drift — life without illustrations. */
export function Sparkles({ color }: { color: string }) {
  const spots = [
    { top: '14%', left: '12%', size: 14, delay: 0 },
    { top: '22%', left: '82%', size: 10, delay: 700 },
    { top: '34%', left: '20%', size: 9, delay: 1300 },
    { top: '30%', left: '70%', size: 16, delay: 400 },
  ] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {spots.map((spot, i) => (
        <Star key={i} {...spot} color={color} />
      ))}
    </View>
  );
}

function Star({
  top,
  left,
  size,
  delay,
  color,
}: {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  delay: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + t.value * 0.65,
    transform: [{ translateY: -6 * t.value }, { scale: 0.8 + t.value * 0.35 }],
  }));
  return (
    <Animated.Text style={[{ position: 'absolute', top, left, fontSize: size, color }, style]}>✦</Animated.Text>
  );
}

/** The house mark, floating gently in a soft halo. */
export function FloatingMark() {
  const { accentTheme } = useOrbit();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -10 * t.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + 0.3 * t.value, transform: [{ scale: 0.95 + 0.1 * t.value }] }));
  return (
    <View style={styles.markWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: `${accentTheme.primary}33` }, halo]} />
      <Animated.View style={float}>
        <ChoremaxxLogo size="lg" variant="icon" />
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  markWrap: { alignItems: 'center', height: 150, justifyContent: 'center' },
  halo: { borderRadius: 80, height: 150, position: 'absolute', width: 150 },
});

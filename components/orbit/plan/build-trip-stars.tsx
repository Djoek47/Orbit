/**
 * Soft star drift behind the Build trip card — calm, not firework spam.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type Props = {
  color: string;
  active?: boolean;
};

function Star({
  color,
  delay,
  left,
  top,
  size,
  active,
}: {
  color: string;
  delay: number;
  left: `${number}%`;
  top: number;
  size: number;
  active: boolean;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      t.value = 0.35;
      return;
    }
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0.2, { duration: 1100, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [active, delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scale: 0.7 + t.value * 0.55 }, { rotate: `${t.value * 25}deg` }],
  }));

  return (
    <Animated.View style={[styles.star, { left, top }, style]} pointerEvents="none">
      <MaterialIcons name="auto-awesome" size={size} color={color} />
    </Animated.View>
  );
}

export function BuildTripStars({ color, active = true }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const live = active && !reduceMotion;

  return (
    <View style={styles.layer} pointerEvents="none">
      <Star color={color} delay={0} left="8%" top={10} size={14} active={live} />
      <Star color={color} delay={220} left="78%" top={6} size={12} active={live} />
      <Star color={color} delay={480} left="62%" top={36} size={10} active={live} />
      <Star color={color} delay={140} left="28%" top={44} size={11} active={live} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
  },
});

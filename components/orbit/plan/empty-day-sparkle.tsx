/**
 * The "nothing scheduled" sparkle. It breathes and turns a little, so an empty day looks like a
 * free one rather than a screen that failed to load. Still when Reduce Motion is on.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Moji } from '@/components/orbit/moji/moji';

export function EmptyDaySparkle({ size = 34 }: { size?: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const t = useSharedValue(0);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      t.set(0);
      return;
    }
    t.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.68 + t.get() * 0.32,
    transform: [{ scale: 0.94 + t.get() * 0.12 }, { rotate: `${-5 + t.get() * 10}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Moji name="sparkles" size={size} />
    </Animated.View>
  );
}

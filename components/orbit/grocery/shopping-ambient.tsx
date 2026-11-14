/**
 * The two soft glows behind the shopping list. They drift slowly so the glass has something to
 * catch — gold top-left, warm primary bottom-right. Still when Reduce Motion is on.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { ShoppingPalette } from '@/lib/grocery/shopping-palette';

export function ShoppingAmbient({
  palette,
  reduceMotion,
}: {
  palette: ShoppingPalette;
  reduceMotion: boolean;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.set(0);
      return;
    }
    t.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, t]);

  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.get() * 46 },
      { translateY: t.get() * 28 },
      { scale: 1 + t.get() * 0.08 },
    ],
  }));
  const b = useAnimatedStyle(() => ({
    transform: [
      { translateX: -t.get() * 38 },
      { translateY: -t.get() * 42 },
      { scale: 1.06 - t.get() * 0.08 },
    ],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[styles.wash, { top: -40, left: -60, backgroundColor: palette.ambientA }, a]}
      />
      <Animated.View
        style={[
          styles.wash,
          { bottom: 80, right: -40, width: 220, height: 220, backgroundColor: palette.ambientB },
          b,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    borderRadius: 140,
    height: 280,
    opacity: 0.55,
    position: 'absolute',
    width: 280,
  },
});

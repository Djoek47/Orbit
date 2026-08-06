import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ONBOARDING_SPLASH_HOOKS } from '@/lib/onboarding-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type SplashHooksProps = {
  visible: boolean;
};

const CYCLE_MS = 2800;
const FADE_MS = 380;

/**
 * Get Started splash hooks — shows one of the three phrases at a time and cycles.
 */
export function SplashHooks({ visible }: SplashHooksProps) {
  const { c } = useOrbitColors();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }

    if (!visible) {
      opacity.value = 0;
      translateY.value = 8;
      setIndex(0);
      return;
    }

    opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });

    const id = setInterval(() => {
      opacity.value = withTiming(0, { duration: FADE_MS * 0.65, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-6, { duration: FADE_MS * 0.65 });
      fadeTimer.current = setTimeout(() => {
        setIndex((current) => (current + 1) % ONBOARDING_SPLASH_HOOKS.length);
        translateY.value = 8;
        opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
      }, FADE_MS * 0.7);
    }, CYCLE_MS);

    return () => {
      clearInterval(id);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [visible, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const hook = ONBOARDING_SPLASH_HOOKS[index] ?? ONBOARDING_SPLASH_HOOKS[0];

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.row, style]}>
        <View style={[styles.dot, { backgroundColor: hook.color }]} />
        <Text style={[styles.text, { color: c.textMuted }]}>{hook.text}</Text>
      </Animated.View>
      <View style={styles.pips}>
        {ONBOARDING_SPLASH_HOOKS.map((item, i) => (
          <View
            key={item.text}
            style={[
              styles.pip,
              {
                backgroundColor: i === index ? item.color : c.textFaint,
                opacity: i === index ? 1 : 0.4,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: 16,
  },
  dot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  pips: {
    flexDirection: 'row',
    gap: 6,
  },
  pip: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },
});

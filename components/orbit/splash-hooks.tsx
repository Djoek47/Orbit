import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
 * Get Started splash hooks — one phrase at a time.
 * Blur pill behind the line (TestFlight: text was lost on the glow).
 * Position sits lower under the brand tagline (screenshot_02).
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
      <Animated.View style={[styles.pillOuter, style]}>
        {Platform.OS === 'web' ? (
          <View style={[styles.pillFill, { backgroundColor: c.isDark ? 'rgba(12,14,20,0.72)' : 'rgba(255,255,255,0.78)' }]} />
        ) : (
          <BlurView
            intensity={48}
            tint={c.isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <View
          style={[
            styles.pillScrim,
            { backgroundColor: c.isDark ? 'rgba(8,10,16,0.45)' : 'rgba(255,252,248,0.55)' },
          ]}
        />
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: hook.color }]} />
          <Text style={[styles.text, { color: c.text }]}>{hook.text}</Text>
        </View>
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
    gap: 16,
    marginTop: 28,
    minHeight: 56,
    paddingHorizontal: 12,
    width: '100%',
  },
  pillOuter: {
    alignItems: 'center',
    borderRadius: 999,
    maxWidth: '100%',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillFill: {
    ...StyleSheet.absoluteFillObject,
  },
  pillScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    maxWidth: '100%',
    zIndex: 1,
  },
  dot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  text: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
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

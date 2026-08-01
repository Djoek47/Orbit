import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ONBOARDING_SPLASH_HOOKS } from '@/lib/onboarding-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type SplashHooksProps = {
  visible: boolean;
};

function HookRow({
  text,
  color,
  index,
  visible,
  muted,
}: {
  text: string;
  color: string;
  index: number;
  visible: boolean;
  muted: string;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const dotScale = useSharedValue(0.2);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      translateY.value = 10;
      dotScale.value = 0.2;
      return;
    }
    const delay = 80 + index * 120;
    opacity.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 140 }));
    dotScale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 }));
  }, [visible, index, opacity, translateY, dotScale]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View style={[styles.hookRow, rowStyle]}>
      <Animated.View style={[styles.hookDot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.hookText, { color: muted }]}>{text}</Text>
    </Animated.View>
  );
}

/** Centered splash micro-hooks with staggered colored-dot entrance. */
export function SplashHooks({ visible }: SplashHooksProps) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.wrap} pointerEvents="none">
      {ONBOARDING_SPLASH_HOOKS.map((hook, index) => (
        <HookRow
          key={hook.text}
          text={hook.text}
          color={hook.color}
          index={index}
          visible={visible}
          muted={c.textMuted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  hookRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  hookDot: {
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  hookText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});

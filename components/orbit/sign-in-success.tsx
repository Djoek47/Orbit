import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ChoremaxxLogo, ChoremaxxMark } from '@/components/orbit/choremaxx-logo';
import { resolveBrandLockup } from '@/constants/brand-lockup';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type SignInSuccessProps = {
  visible: boolean;
  onDone: () => void;
};

/** Short brand beat after successful auth before routing home. */
export function SignInSuccess({ visible, onDone }: SignInSuccessProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { c } = useOrbitColors();
  const orbit = useOrbitOptional();
  const lockup = resolveBrandLockup(orbit?.accentTheme.id, c.isDark ?? false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.7);
  const wordOpacity = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    opacity.value = withTiming(1, { duration: 280 });
    glow.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    wordOpacity.value = withDelay(220, withTiming(1, { duration: 400 }));

    const timer = setTimeout(() => {
      onDoneRef.current();
    }, 1400);
    return () => clearTimeout(timer);
  }, [glow, opacity, scale, visible, wordOpacity]);

  const shellStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: glow.value,
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.85,
    transform: [{ scale: 0.9 + glow.value * 0.12 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={[styles.root, { backgroundColor: c.background }, shellStyle]}>
        <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
          <LinearGradient
            colors={[`${lockup.markBg}66`, `${lockup.bars}33`, 'transparent']}
            style={styles.glow}
          />
        </Animated.View>
        <Animated.View style={iconStyle}>
          <ChoremaxxMark width={72} height={72} colors={lockup} />
        </Animated.View>
        <Animated.View style={wordStyle}>
          <ChoremaxxLogo variant="wordmark" size="md" />
        </Animated.View>
        <Animated.View style={wordStyle}>
          <Text style={[styles.welcome, { color: c.textSoft }]}>Welcome back</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    gap: 18,
    justifyContent: 'center',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    borderRadius: 180,
    height: 240,
    width: 240,
  },
  welcome: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});

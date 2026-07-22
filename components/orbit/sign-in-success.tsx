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

import { ChoremaxxIcon } from '@/components/orbit/choremaxx-logo';
import { choremaxxBrand } from '@/constants/choremaxx-brand';
import { orbitColors } from '@/constants/orbit-theme';

type SignInSuccessProps = {
  visible: boolean;
  onDone: () => void;
};

/** Short brand beat after successful auth before routing home. */
export function SignInSuccess({ visible, onDone }: SignInSuccessProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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
      <Animated.View style={[styles.root, shellStyle]}>
        <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(89,178,225,0.4)', 'rgba(118,196,174,0.2)', 'transparent']}
            style={styles.glow}
          />
        </Animated.View>
        <Animated.View style={iconStyle}>
          <ChoremaxxIcon width={64} height={55} />
        </Animated.View>
        <Animated.View style={[styles.wordRow, wordStyle]}>
          <Text style={styles.chorema}>chorema</Text>
          <Text style={styles.xPrimary}>x</Text>
          <Text style={styles.xFaded}>x</Text>
        </Animated.View>
        <Animated.View style={wordStyle}>
          <Text style={styles.welcome}>Welcome back</Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: orbitColors.background,
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
  wordRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  chorema: {
    color: choremaxxBrand.cyan,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  xPrimary: {
    color: choremaxxBrand.slate,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  xFaded: {
    color: choremaxxBrand.faded,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1.2,
    opacity: 0.9,
  },
  welcome: {
    color: orbitColors.textSoft,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});

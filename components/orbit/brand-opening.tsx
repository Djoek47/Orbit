import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ChoremaxxIcon, ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { SpinningLogoGlow } from '@/components/orbit/spinning-logo-glow';
import { resolveBrandLockup } from '@/constants/brand-lockup';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type BrandOpeningProps = {
  /** Called once the intro settle finishes (CTAs can appear). */
  onReady?: () => void;
  tagline?: string;
};

/**
 * Full-bleed brand opening: glow → theme mark → chore/maxx wordmark → tagline.
 * Keeps breathing after settle so the splash still feels alive.
 */
export function BrandOpening({
  onReady,
  tagline = 'Run the household',
}: BrandOpeningProps) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const { c } = useOrbitColors();
  const orbit = useOrbitOptional();
  const lockup = resolveBrandLockup(orbit?.accentTheme.id, c.isDark ?? false);

  const glow = useSharedValue(0);
  const glowSpin = useSharedValue(0);
  const iconScale = useSharedValue(0.28);
  const iconOpacity = useSharedValue(0);
  const wordOpacity = useSharedValue(0);
  const wordX = useSharedValue(18);
  const tagOpacity = useSharedValue(0);
  const tagY = useSharedValue(14);
  const breath = useSharedValue(1);
  const sparkle = useSharedValue(0.7);

  useEffect(() => {
    glow.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    glowSpin.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );
    iconOpacity.value = withTiming(1, { duration: 420 });
    iconScale.value = withSpring(1, { damping: 12, stiffness: 140, mass: 0.85 });

    wordOpacity.value = withDelay(380, withTiming(1, { duration: 520 }));
    wordX.value = withDelay(380, withSpring(0, { damping: 16, stiffness: 120 }));

    tagOpacity.value = withDelay(720, withTiming(1, { duration: 560 }));
    tagY.value = withDelay(720, withSpring(0, { damping: 18, stiffness: 110 }));

    breath.value = withDelay(
      900,
      withRepeat(
        withTiming(1.035, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    sparkle.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.65, { duration: 1100, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );

    const readyTimer = setTimeout(() => {
      onReadyRef.current?.();
    }, 1600);
    return () => clearTimeout(readyTimer);
    // Shared values are stable; run intro once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.9]),
    transform: [{ scale: breath.value }, { rotate: `${glowSpin.value}deg` }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value * breath.value }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.value,
    transform: [{ scale: interpolate(sparkle.value, [0.65, 1], [0.92, 1.08]) }],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateX: wordX.value }],
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagY.value }],
  }));

  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="Choremaxx">
      <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
        <LinearGradient
          colors={[`${c.primary}59`, `${lockup.wash}2E`, 'transparent']}
          style={styles.glow}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.9, y: 0.95 }}
        />
        <View style={styles.glowSpinOverlay} pointerEvents="none">
          <SpinningLogoGlow size={260} />
        </View>
      </Animated.View>

      <View style={styles.lockup}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Animated.View
            style={[styles.sparkleHalo, sparkleStyle, { backgroundColor: `${lockup.sparkle}33` }]}
          />
          <ChoremaxxIcon width={84} height={72} colors={lockup} />
        </Animated.View>

        <Animated.View style={wordStyle}>
          <ChoremaxxLogo variant="wordmark" size="lg" />
        </Animated.View>
      </View>

      <Animated.View style={tagStyle}>
        <Text style={[styles.tagline, { color: c.textSoft }]}>{tagline}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    width: '100%',
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    borderRadius: 200,
    height: 280,
    width: 280,
  },
  glowSpinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
    gap: 18,
  },
  iconWrap: {
    alignItems: 'center',
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  sparkleHalo: {
    borderRadius: 28,
    height: 56,
    left: 14,
    position: 'absolute',
    top: -4,
    width: 56,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});

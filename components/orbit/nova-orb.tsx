import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type NovaOrbProps = {
  size?: number;
  speaking?: boolean;
};

/** Make NovaOrb — radial blue core + 1.6x / 1.3x glow rings. */
export function NovaOrb({ size = 80, speaking = false }: NovaOrbProps) {
  const pulse = useSharedValue(1);
  const outerGlow = useSharedValue(0.6);
  const midGlow = useSharedValue(0.7);
  const shimmer = useSharedValue(0.4);
  const aurora = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(speaking ? 1.04 : 1.02, {
        duration: speaking ? 800 : 4000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    outerGlow.value = withRepeat(
      withTiming(1, { duration: speaking ? 1200 : 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    midGlow.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    shimmer.value = withRepeat(
      withTiming(0.9, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    aurora.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [aurora, midGlow, outerGlow, pulse, shimmer, speaking]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: outerGlow.value,
    transform: [
      {
        scale: speaking ? 1 + (outerGlow.value - 0.6) * 0.375 : 1 + (outerGlow.value - 0.6) * 0.125,
      },
    ],
  }));

  const midGlowStyle = useAnimatedStyle(() => ({
    opacity: midGlow.value,
    transform: [{ scale: 1 + (midGlow.value - 0.7) * 0.27 }],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  const auroraStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${aurora.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.6,
            height: size * 1.6,
            borderRadius: size * 0.8,
          },
          outerGlowStyle,
        ]}>
        <View style={[styles.glowFill, { backgroundColor: 'rgba(56,189,248,0.12)' }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.3,
            height: size * 1.3,
            borderRadius: size * 0.65,
          },
          midGlowStyle,
        ]}>
        <View style={[styles.glowFill, { backgroundColor: 'rgba(6,182,212,0.18)' }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          coreStyle,
        ]}>
        <LinearGradient
          colors={['#7DD3FC', '#0EA5E9', '#0369A1', '#0C1E3C']}
          locations={[0, 0.4, 0.75, 1]}
          start={{ x: 0.35, y: 0.3 }}
          end={{ x: 0.65, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={['rgba(6,182,212,0.6)', 'transparent']}
            start={{ x: 0.65, y: 0.7 }}
            end={{ x: 0.2, y: 0.2 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.highlight} />

        <Animated.View style={[styles.aurora, auroraStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(56,189,248,0.3)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    overflow: 'hidden',
  },
  glowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
  },
  core: {
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    height: '28%',
    left: '20%',
    position: 'absolute',
    top: '14%',
    width: '35%',
  },
  aurora: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    opacity: 0.85,
  },
});

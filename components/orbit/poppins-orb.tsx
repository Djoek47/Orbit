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

export type PoppinsOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

type PoppinsOrbProps = {
  size?: number;
  speaking?: boolean;
  state?: PoppinsOrbState;
};

const STATE_GLOW: Record<PoppinsOrbState, string> = {
  idle: 'rgba(56,189,248,0.12)',
  listening: 'rgba(52,211,153,0.28)',
  thinking: 'rgba(167,139,250,0.28)',
  speaking: 'rgba(56,189,248,0.3)',
  success: 'rgba(52,211,153,0.38)',
};

/** Make Poppins glass orb — iridescent core + state glow rings. */
export function PoppinsOrb({ size = 80, speaking = false, state }: PoppinsOrbProps) {
  const visual: PoppinsOrbState = state ?? (speaking ? 'speaking' : 'idle');
  const isActive = visual !== 'idle';
  const pulse = useSharedValue(1);
  const outerGlow = useSharedValue(0.6);
  const midGlow = useSharedValue(0.7);
  const shimmer = useSharedValue(0.4);
  const ring = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(isActive ? 1.03 : 1.015, {
        duration: visual === 'listening' ? 600 : 3000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    outerGlow.value = withRepeat(
      withTiming(1, { duration: isActive ? 1200 : 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    midGlow.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    shimmer.value = withRepeat(
      withTiming(0.9, { duration: visual === 'speaking' ? 1200 : 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    ring.value = withRepeat(
      withTiming(360, { duration: isActive ? 4000 : 12000, easing: Easing.linear }),
      -1,
      false
    );
  }, [isActive, midGlow, outerGlow, pulse, ring, shimmer, visual]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: outerGlow.value * (isActive ? 0.9 : 0.55),
    transform: [{ scale: 1 + (outerGlow.value - 0.6) * (isActive ? 0.45 : 0.12) }],
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

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value}deg` }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size * 0.775,
          },
          outerGlowStyle,
        ]}>
        <View style={[styles.glowFill, { backgroundColor: STATE_GLOW[visual] }]} />
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

      {!isActive ? (
        <View
          style={{
            position: 'absolute',
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderWidth: 1,
            borderColor: 'rgba(56,189,248,0.12)',
          }}
        />
      ) : null}

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
          colors={['rgba(255,255,255,0.55)', 'rgba(180,200,255,0.35)', '#6366F1', '#140F3C', '#000000']}
          locations={[0, 0.18, 0.42, 0.72, 1]}
          start={{ x: 0.32, y: 0.28 }}
          end={{ x: 0.7, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={
              visual === 'listening'
                ? ['rgba(52,211,153,0.45)', 'transparent']
                : visual === 'thinking'
                  ? ['rgba(167,139,250,0.5)', 'transparent']
                  : ['rgba(56,189,248,0.55)', 'transparent']
            }
            start={{ x: 0.4, y: 0.35 }}
            end={{ x: 0.75, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.highlight} />
        <View style={styles.highlightSmall} />

        <Animated.View
          style={[
            styles.orbitRing,
            {
              top: size * 0.14,
              left: size * 0.14,
              right: size * 0.14,
              bottom: size * 0.14,
              borderRadius: size,
            },
            ringStyle,
          ]}
        />
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
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    height: '22%',
    left: '18%',
    position: 'absolute',
    top: '8%',
    width: '38%',
    opacity: 0.7,
  },
  highlightSmall: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 999,
    height: '10%',
    left: '22%',
    position: 'absolute',
    top: '14%',
    width: '18%',
  },
  orbitRing: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1.5,
    position: 'absolute',
  },
});

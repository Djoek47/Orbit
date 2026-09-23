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
  /** 0–1 daily actions remaining. Water sits at this line. */
  dailyFill?: number;
  /** 0–1 monthly actions remaining. Outer glow strength. */
  monthGlow?: number;
  /** Voice accent (hex). Tints glass and water. */
  accent?: string;
};

const STATE_TINT: Record<PoppinsOrbState, string> = {
  idle: '#38BDF8',
  listening: '#34D399',
  thinking: '#A78BFA',
  speaking: '#38BDF8',
  success: '#34D399',
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Glass orb. Water is the day left; the halo is the month left. */
export function PoppinsOrb({
  size = 80,
  speaking = false,
  state,
  dailyFill,
  monthGlow,
  accent,
}: PoppinsOrbProps) {
  const visual: PoppinsOrbState = state ?? (speaking ? 'speaking' : 'idle');
  const isActive = visual !== 'idle';
  const tint = accent ?? STATE_TINT[visual];
  const fillTarget = clamp01(dailyFill ?? 0.68);
  const glowTarget = clamp01(monthGlow ?? 0.72);

  const pulse = useSharedValue(1);
  const wave = useSharedValue(0);
  const fill = useSharedValue(fillTarget);
  const halo = useSharedValue(glowTarget);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(isActive ? 1.035 : 1.012, {
        duration: visual === 'listening' ? 700 : 3200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
    wave.value = withRepeat(
      withTiming(1, { duration: visual === 'speaking' ? 1600 : 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [isActive, pulse, visual, wave]);

  useEffect(() => {
    fill.value = withTiming(fillTarget, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [fill, fillTarget]);

  useEffect(() => {
    halo.value = withTiming(glowTarget, { duration: 800 });
  }, [glowTarget, halo]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + halo.value * (isActive ? 0.72 : 0.55),
    transform: [{ scale: 1.08 + halo.value * 0.22 }],
  }));

  const waterStyle = useAnimatedStyle(() => ({
    height: Math.max(size * 0.06, fill.value * size + size * 0.06),
  }));

  const crestStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (wave.value - 0.5) * size * 0.35 },
      { rotate: '-8deg' },
    ],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size,
            backgroundColor: tint,
            shadowColor: tint,
          },
          haloStyle,
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size + 10,
          height: size + 10,
          borderRadius: (size + 10) / 2,
          borderWidth: Math.max(1.5, size * 0.012),
          borderColor: tint,
          opacity: 0.22 + glowTarget * 0.55,
        }}
      />

      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: 'rgba(255,255,255,0.28)',
          },
          coreStyle,
        ]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(12,18,40,0.2)', '#070B18']}
          locations={[0, 0.42, 1]}
          start={{ x: 0.3, y: 0.15 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.water, waterStyle]}>
          <LinearGradient
            colors={[`${tint}EE`, `${tint}99`, 'rgba(8,16,40,0.15)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.crest,
              {
                width: size * 1.4,
                height: size * 0.28,
                borderRadius: size,
                backgroundColor: `${tint}CC`,
                top: -size * 0.1,
              },
              crestStyle,
            ]}
          />
        </Animated.View>
        <LinearGradient
          colors={
            visual === 'listening'
              ? ['rgba(52,211,153,0.28)', 'transparent']
              : visual === 'thinking'
                ? ['rgba(167,139,250,0.32)', 'transparent']
                : ['rgba(255,255,255,0.18)', 'transparent']
          }
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.7 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          style={[
            styles.highlight,
            { width: size * 0.38, height: size * 0.18, top: size * 0.08, left: size * 0.16 },
          ]}
        />
        <View
          style={[
            styles.highlightHot,
            { width: size * 0.16, height: size * 0.08, top: size * 0.12, left: size * 0.22 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    shadowOpacity: 0.85,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  core: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  water: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
  },
  crest: {
    position: 'absolute',
    left: '-20%',
    opacity: 0.85,
  },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderRadius: 999,
    position: 'absolute',
  },
  highlightHot: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    position: 'absolute',
  },
});

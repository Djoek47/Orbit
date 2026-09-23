import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { monthRingDash } from '@/lib/poppins/orb-ring';

export type PoppinsOrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

type PoppinsOrbProps = {
  size?: number;
  speaking?: boolean;
  state?: PoppinsOrbState;
  /** 0–1 daily actions remaining. The water sits on this line. */
  dailyFill?: number;
  /** 0–1 monthly actions remaining. Edge-lit ring, open at the top as this falls. */
  monthGlow?: number;
  /** Voice accent (hex). Tints glass, water, and the ring. */
  accent?: string;
};

const STATE_TINT: Record<PoppinsOrbState, string> = {
  idle: '#38BDF8',
  listening: '#34D399',
  thinking: '#A78BFA',
  speaking: '#38BDF8',
  success: '#34D399',
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function surfacePath(width: number, base: number, phase: number, amp: number, close: boolean): string {
  'worklet';
  const steps = 22;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = width * t;
    const y =
      base +
      Math.sin(phase * Math.PI * 2 + t * Math.PI * 2) * amp +
      Math.sin(phase * Math.PI * 4 + t * Math.PI * 3.2) * amp * 0.38;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  if (close) {
    d += ` L ${width} ${width + 4} L 0 ${width + 4} Z`;
  }
  return d;
}

/** Glass orb. Water is the day left. The rim is the month left. */
export function PoppinsOrb({
  size = 80,
  speaking = false,
  state,
  dailyFill,
  monthGlow,
  accent,
}: PoppinsOrbProps) {
  const visual: PoppinsOrbState = state ?? (speaking ? 'speaking' : 'idle');
  const tint = accent ?? STATE_TINT[visual];
  const fillTarget = clamp01(dailyFill ?? 0.68);
  const glowTarget = clamp01(monthGlow ?? 0.72);

  const ringPad = Math.max(12, size * 0.07);
  const svg = size + ringPad * 2;
  const cx = svg / 2;
  const cy = svg / 2;
  const ringR = size / 2 + Math.max(4, size * 0.03);
  const coreStroke = Math.max(1.75, size * 0.012);
  const phaseA = useSharedValue(0);
  const phaseB = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(1);
  const fill = useSharedValue(fillTarget);
  const halo = useSharedValue(glowTarget);
  const flourish = useSharedValue(0);
  const energy = useSharedValue(visual === 'idle' ? 0.2 : 0.7);
  const accentSv = useSharedValue(tint);
  const lastGlow = useRef(glowTarget);
  const seenGlow = useRef(false);

  useEffect(() => {
    phaseA.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.linear }),
      -1,
      false
    );
    phaseB.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.018, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [phaseA, phaseB, pulse, shimmer]);

  useEffect(() => {
    const next = visual === 'speaking' ? 1 : visual === 'listening' ? 0.72 : visual === 'thinking' ? 0.4 : 0.22;
    energy.value = withTiming(next, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [energy, visual]);

  useEffect(() => {
    fill.value = withTiming(fillTarget, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [fill, fillTarget]);

  useEffect(() => {
    accentSv.value = tint;
  }, [accentSv, tint]);

  useEffect(() => {
    if (!seenGlow.current) {
      seenGlow.current = true;
      lastGlow.current = glowTarget;
      halo.value = glowTarget;
      return;
    }
    const previous = lastGlow.current;
    lastGlow.current = glowTarget;
    halo.value = withTiming(glowTarget, { duration: 1100, easing: Easing.out(Easing.cubic) });
    if (glowTarget < previous - 0.004) {
      flourish.value = 0;
      flourish.value = withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) });
    }
  }, [flourish, glowTarget, halo]);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const backWave = useAnimatedProps(() => {
    const amp = size * (0.028 + energy.value * 0.04);
    const base = size * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(size, base + amp * 0.15, phaseA.value, amp * 0.85, true) };
  });

  const frontWave = useAnimatedProps(() => {
    const amp = size * (0.026 + energy.value * 0.042);
    const swell = 0.82 + 0.18 * Math.sin(phaseA.value * Math.PI * 2);
    const base = size * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(size, base, phaseB.value, amp * swell, true) };
  });

  const waterline = useAnimatedProps(() => {
    const amp = size * (0.022 + energy.value * 0.036);
    const base = size * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(size, base, phaseB.value, amp, false) };
  });

  const caustic = useAnimatedProps(() => {
    const level = Math.max(0.045, fill.value);
    return {
      cx: size * (0.42 + 0.16 * Math.sin(phaseA.value * Math.PI * 2)),
      cy: size * (1 - level * 0.48),
      opacity: 0.14 + energy.value * 0.12,
    };
  });

  const bloomProps = useAnimatedProps(() => {
    const dash = monthRingDash(halo.value, ringR);
    return {
      strokeDasharray: `${dash.visible} ${Math.max(dash.gap, 0.01)}`,
      strokeDashoffset: dash.offset,
      opacity: dash.opacity * 0.42,
    };
  });

  const midProps = useAnimatedProps(() => {
    const dash = monthRingDash(halo.value, ringR);
    return {
      strokeDasharray: `${dash.visible} ${Math.max(dash.gap, 0.01)}`,
      strokeDashoffset: dash.offset,
      opacity: dash.opacity * 0.9,
    };
  });

  const coreRingProps = useAnimatedProps(() => {
    const dash = monthRingDash(halo.value, ringR);
    return {
      strokeDasharray: `${dash.visible} ${Math.max(dash.gap, 0.01)}`,
      strokeDashoffset: dash.offset,
      opacity: dash.opacity,
    };
  });

  const rainbowProps = useAnimatedProps(() => {
    const dash = monthRingDash(halo.value, ringR);
    const peak = Math.sin(flourish.value * Math.PI);
    const travel = (shimmer.value + flourish.value) % 1;
    return {
      strokeDasharray: `${dash.visible} ${Math.max(dash.gap, 0.01)}`,
      strokeDashoffset: dash.offset,
      opacity: dash.opacity * (0.18 + peak * 0.82),
      stroke: interpolateColor(
        travel,
        [0, 0.25, 0.5, 0.75, 1],
        [accentSv.value, '#FFFFFF', '#67E8F9', '#E9D5FF', accentSv.value]
      ),
    };
  });

  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={svg} height={svg} style={[styles.ringSvg, { left: -ringPad, top: -ringPad }]}>
        <AnimatedCircle
          animatedProps={bloomProps}
          cx={cx}
          cy={cy}
          r={ringR}
          stroke={tint}
          strokeWidth={coreStroke * 4.2}
          fill="none"
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
        <AnimatedCircle
          animatedProps={midProps}
          cx={cx}
          cy={cy}
          r={ringR}
          stroke={tint}
          strokeWidth={coreStroke * 1.85}
          fill="none"
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
        <AnimatedCircle
          animatedProps={rainbowProps}
          cx={cx}
          cy={cy}
          r={ringR}
          strokeWidth={coreStroke * 1.35}
          fill="none"
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
        <AnimatedCircle
          animatedProps={coreRingProps}
          cx={cx}
          cy={cy}
          r={ringR}
          stroke="#FFFFFF"
          strokeWidth={Math.max(1.1, coreStroke * 0.55)}
          fill="none"
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: 'rgba(255,255,255,0.38)',
            shadowColor: tint,
          },
          coreStyle,
        ]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'rgba(12,18,40,0.08)', '#070B18']}
          locations={[0, 0.38, 1]}
          start={{ x: 0.28, y: 0.08 }}
          end={{ x: 0.72, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={backWave} fill={tint} opacity={0.45} />
          <AnimatedPath animatedProps={frontWave} fill={tint} opacity={0.88} />
          <AnimatedEllipse
            animatedProps={caustic}
            rx={size * 0.22}
            ry={size * 0.1}
            fill="#FFFFFF"
          />
          <AnimatedPath
            animatedProps={waterline}
            stroke="rgba(255,255,255,0.82)"
            strokeWidth={Math.max(1.25, size * 0.008)}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
        <LinearGradient
          colors={
            visual === 'listening'
              ? ['rgba(52,211,153,0.22)', 'transparent']
              : visual === 'thinking'
                ? ['rgba(167,139,250,0.26)', 'transparent']
                : ['rgba(255,255,255,0.16)', 'transparent']
          }
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 0.65 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View
          style={[
            styles.highlight,
            { width: size * 0.38, height: size * 0.16, top: size * 0.08, left: size * 0.16 },
          ]}
        />
        <View
          style={[
            styles.highlightHot,
            { width: size * 0.14, height: size * 0.07, top: size * 0.11, left: size * 0.22 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringSvg: {
    position: 'absolute',
  },
  core: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderRadius: 999,
    position: 'absolute',
  },
  highlightHot: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 999,
    position: 'absolute',
  },
});

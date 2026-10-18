/**
 * Glass orb — credit as liquid (WO13).
 * Water = day left; rim = month left; tint = voice/majordomo (never domain colour).
 * One instance resizes (196 / 72 / 34); drain preview is a dashed line while a card is held.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import { motion, motionDuration } from '@/constants/motion-tokens';
import { ORB_AMBER_THRESHOLD, clamp01 } from '@/lib/poppins/orb-levels';
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
  /** Voice / majordomo accent (hex). Never a domain colour. */
  accent?: string;
  /**
   * Optional post-commit water level (0–1). Draws a dashed preview line while a card is held.
   * Omit when idle / not holding.
   */
  drainPreview?: number | null;
};

const STATE_TINT: Record<PoppinsOrbState, string> = {
  idle: '#38BDF8',
  listening: '#34D399',
  thinking: '#A78BFA',
  speaking: '#38BDF8',
  success: '#34D399',
};

const AMBER_WATER = '#FB923C';
/** Internal draw size — layout size is animated via scale so one SVG tree stays mounted. */
const DRAW = 196;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedLine = Animated.createAnimatedComponent(Line);

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
  drainPreview = null,
}: PoppinsOrbProps) {
  const visual: PoppinsOrbState = state ?? (speaking ? 'speaking' : 'idle');
  const fillTarget = clamp01(dailyFill ?? 0.68);
  const glowTarget = clamp01(monthGlow ?? 0.72);
  const amber = fillTarget > 0 && fillTarget < ORB_AMBER_THRESHOLD;
  const tint = accent ?? STATE_TINT[visual];
  const waterTint = amber ? AMBER_WATER : tint;
  const showDrain = drainPreview != null && Number.isFinite(drainPreview);
  const drainLevel = clamp01(drainPreview ?? fillTarget);

  const ringPad = Math.max(12, DRAW * 0.07);
  const svg = DRAW + ringPad * 2;
  const cx = svg / 2;
  const cy = svg / 2;
  const ringR = DRAW / 2 + Math.max(4, DRAW * 0.03);
  const coreStroke = Math.max(1.75, DRAW * 0.012);

  const phaseA = useSharedValue(0);
  const phaseB = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(1);
  const fill = useSharedValue(fillTarget);
  const halo = useSharedValue(glowTarget);
  const flourish = useSharedValue(0);
  const energy = useSharedValue(visual === 'idle' ? 0.2 : 0.7);
  const accentSv = useSharedValue(tint);
  const sizeScale = useSharedValue(size / DRAW);
  const drainY = useSharedValue(DRAW * (1 - Math.max(0.045, drainLevel)));
  const drainOpacity = useSharedValue(showDrain ? 1 : 0);
  const lastGlow = useRef(glowTarget);
  const seenGlow = useRef(false);
  const reduceMotion = useSharedValue(0);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.value = v ? 1 : 0;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion.value = v ? 1 : 0;
    });
    return () => sub.remove();
  }, [reduceMotion]);

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
    const next =
      visual === 'speaking' ? 1 : visual === 'listening' ? 0.72 : visual === 'thinking' ? 0.4 : 0.22;
    energy.value = withTiming(next, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [energy, visual]);

  useEffect(() => {
    fill.value = withTiming(fillTarget, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [fill, fillTarget]);

  useEffect(() => {
    accentSv.value = tint;
  }, [accentSv, tint]);

  useEffect(() => {
    sizeScale.value = withSpring(size / DRAW, motion.settle);
  }, [size, sizeScale]);

  useEffect(() => {
    const y = DRAW * (1 - Math.max(0.045, drainLevel));
    if (reduceMotion.value) {
      drainY.value = y;
      drainOpacity.value = showDrain ? 1 : 0;
      return;
    }
    drainY.value = withTiming(y, {
      duration: motionDuration.smooth,
      easing: Easing.out(Easing.cubic),
    });
    drainOpacity.value = withTiming(showDrain ? 1 : 0, {
      duration: motionDuration.snappy,
      easing: Easing.out(Easing.cubic),
    });
  }, [drainLevel, drainOpacity, drainY, reduceMotion, showDrain]);

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

  const wrapStyle = useAnimatedStyle(() => ({
    width: sizeScale.value * DRAW,
    height: sizeScale.value * DRAW,
  }));

  /** Draw at DRAW, scale into the layout box — one SVG tree, one resize. */
  const bodyStyle = useAnimatedStyle(() => {
    const layout = sizeScale.value;
    return {
      position: 'absolute' as const,
      left: (DRAW * (layout - 1)) / 2,
      top: (DRAW * (layout - 1)) / 2,
      transform: [{ scale: layout * pulse.value }],
    };
  });
  const backWave = useAnimatedProps(() => {
    const amp = DRAW * (0.028 + energy.value * 0.04);
    const base = DRAW * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(DRAW, base + amp * 0.15, phaseA.value, amp * 0.85, true) };
  });

  const frontWave = useAnimatedProps(() => {
    const amp = DRAW * (0.026 + energy.value * 0.042);
    const swell = 0.82 + 0.18 * Math.sin(phaseA.value * Math.PI * 2);
    const base = DRAW * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(DRAW, base, phaseB.value, amp * swell, true) };
  });

  const waterline = useAnimatedProps(() => {
    const amp = DRAW * (0.022 + energy.value * 0.036);
    const base = DRAW * (1 - Math.max(0.045, fill.value));
    return { d: surfacePath(DRAW, base, phaseB.value, amp, false) };
  });

  const caustic = useAnimatedProps(() => {
    const level = Math.max(0.045, fill.value);
    return {
      cx: DRAW * (0.42 + 0.16 * Math.sin(phaseA.value * Math.PI * 2)),
      cy: DRAW * (1 - level * 0.48),
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

  const drainLineProps = useAnimatedProps(() => ({
    y1: drainY.value,
    y2: drainY.value,
    opacity: drainOpacity.value * 0.9,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="Poppins credit orb"
      style={[styles.wrap, wrapStyle]}>
      <Animated.View style={[styles.body, { width: DRAW, height: DRAW }, bodyStyle]}>
        <Svg
          width={svg}
          height={svg}
          style={[styles.ringSvg, { left: -ringPad, top: -ringPad }]}>
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

        <View
          style={[
            styles.core,
            {
              width: DRAW,
              height: DRAW,
              borderRadius: DRAW / 2,
              borderColor: 'rgba(255,255,255,0.38)',
              shadowColor: tint,
            },
          ]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(12,18,40,0.08)', '#070B18']}
            locations={[0, 0.38, 1]}
            start={{ x: 0.28, y: 0.08 }}
            end={{ x: 0.72, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Svg width={DRAW} height={DRAW} style={StyleSheet.absoluteFill}>
            <AnimatedPath animatedProps={backWave} fill={waterTint} opacity={0.45} />
            <AnimatedPath animatedProps={frontWave} fill={waterTint} opacity={0.88} />
            <AnimatedEllipse
              animatedProps={caustic}
              rx={DRAW * 0.22}
              ry={DRAW * 0.1}
              fill="#FFFFFF"
            />
            <AnimatedPath
              animatedProps={waterline}
              stroke="rgba(255,255,255,0.82)"
              strokeWidth={Math.max(1.25, DRAW * 0.008)}
              fill="none"
              strokeLinecap="round"
            />
            {showDrain ? (
              <AnimatedLine
                animatedProps={drainLineProps}
                x1={DRAW * 0.14}
                x2={DRAW * 0.86}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth={Math.max(1.5, DRAW * 0.01)}
                strokeDasharray={`${Math.max(4, DRAW * 0.035)} ${Math.max(3, DRAW * 0.028)}`}
                strokeLinecap="round"
              />
            ) : null}
          </Svg>
          <LinearGradient
            colors={
              visual === 'listening'
                ? ['rgba(52,211,153,0.22)', 'transparent']
                : visual === 'thinking'
                  ? ['rgba(167,139,250,0.26)', 'transparent']
                  : visual === 'success'
                    ? ['rgba(52,211,153,0.28)', 'transparent']
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
              { width: DRAW * 0.38, height: DRAW * 0.16, top: DRAW * 0.08, left: DRAW * 0.16 },
            ]}
          />
          <View
            style={[
              styles.highlightHot,
              { width: DRAW * 0.14, height: DRAW * 0.07, top: DRAW * 0.11, left: DRAW * 0.22 },
            ]}
          />
          {visual === 'success' ? (
            <View style={styles.tickWrap} pointerEvents="none">
              <MaterialIcons name="check" size={Math.round(DRAW * 0.28)} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tickWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

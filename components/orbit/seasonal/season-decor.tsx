/**
 * Decorations for every season. Each piece renders nothing unless its season is on, so they
 * sit permanently in layouts and buttons; turning the theme off removes them all. None take
 * touches, and all motion stops under Reduce Motion.
 *
 *   Halloween     cobweb, spider, bat (halloween-decor.tsx)
 *   Thanksgiving  maple and oak leaves drifting down, a leaf on primary buttons
 *   Christmas     soft snowfall, a string of twinkling lights, a sprig of holly on buttons
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Moji } from '@/components/orbit/moji/moji';
import {
  ButtonSpookies,
  HalloweenScreenDecor,
} from '@/components/orbit/seasonal/halloween-decor';
import { SEASON_MASCOT, useSeasonal, type SeasonId } from '@/lib/theme/seasonal';
import { useOrbitOptional } from '@/store/orbit-store';

// ── Shapes ───────────────────────────────────────────────────────────────────────────────

/** Six-armed snowflake, every arm identical. */
export function Snowflake({ size = 10, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const arm = 'M0 0 L0 -9 M0 -5.5 L-2.6 -8 M0 -5.5 L2.6 -8';
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      <G stroke={color} strokeWidth={1.6} strokeLinecap="round">
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <Path key={r} d={arm} transform={`rotate(${r})`} />
        ))}
      </G>
    </Svg>
  );
}

const LEAF_COLORS = ['#E8703F', '#C4462A', '#F2A33A', '#B5651D', '#D9922E'];

/** Left half of a maple leaf, stem (bottom) to tip (top); the right half is its mirror. */
const MAPLE_HALF: [number, number][] = [
  [0, 9], [0, 4], [-1.2, 4.6], [-5.6, 3.4], [-4.8, 1.8], [-8.6, -1.4], [-6.8, -2], [-7.6, -5],
  [-4.8, -4.2], [-4.2, -5.6], [-2, -3], [-2.6, -7.4], [-1.2, -6.8], [0, -9.6],
];
const MAPLE_PATH = (() => {
  const right = MAPLE_HALF.slice(1, -1).reverse().map(([x, y]) => [-x, y] as const);
  const pts = [...MAPLE_HALF, ...right];
  return `M ${pts.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
})();

/** A maple leaf, mirror-symmetric about its stem. */
export function MapleLeafShape({ size = 18, color = '#E8703F' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      <Path d={MAPLE_PATH} fill={color} />
      <Path d="M0 9 L0 -6" stroke="rgba(0,0,0,0.22)" strokeWidth={0.8} strokeLinecap="round" />
    </Svg>
  );
}

/** Holly: two leaves and three berries, balanced about the centre line. */
export function Holly({ size = 22 }: { size?: number }) {
  const leaf = 'M0 0 C2 -2 3 -1.2 4.4 -2.6 C4.6 -1.4 6 -1.2 7 -2.4 C7 -1 8.4 -0.4 9.6 -1.2 C8.6 1.4 5 3 0 0 Z';
  return (
    <Svg width={size} height={size * 0.62} viewBox="-11 -5 22 13.6">
      <Path d={leaf} fill="#1F7A4D" transform="translate(1 1)" />
      <Path d={leaf} fill="#2A9460" transform="translate(-1 1) scale(-1 1)" />
      <Circle cx={0} cy={0.4} r={1.9} fill="#E5484D" />
      <Circle cx={-2.2} cy={2.2} r={1.7} fill="#C9363B" />
      <Circle cx={2.2} cy={2.2} r={1.7} fill="#C9363B" />
    </Svg>
  );
}

// ── Falling things ───────────────────────────────────────────────────────────────────────

type Drop = { x: number; size: number; delay: number; duration: number; sway: number; spin: number; color: string };

/** Deterministic spread so the sky looks the same each launch and never clumps. */
function useDrops(count: number, width: number, kind: 'snow' | 'leaf'): Drop[] {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => ((Math.sin((i + 1) * 12.9898 * k) * 43758.5453) % 1 + 1) % 1;
        return {
          x: ((i + 0.5) / count) * width + (r(1) - 0.5) * (width / count),
          size: kind === 'snow' ? 6 + r(2) * 7 : 14 + r(2) * 8,
          delay: r(3) * (kind === 'snow' ? 9000 : 14000),
          duration: kind === 'snow' ? 9000 + r(4) * 6000 : 11000 + r(4) * 6000,
          sway: (kind === 'snow' ? 10 : 26) + r(5) * 14,
          spin: kind === 'snow' ? 90 : 220 + r(6) * 160,
          color: LEAF_COLORS[i % LEAF_COLORS.length]!,
        };
      }),
    [count, width, kind]
  );
}

function Faller({ drop, height, kind }: { drop: Drop; height: number; kind: 'snow' | 'leaf' }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(drop.delay, withRepeat(withTiming(1, { duration: drop.duration, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [drop, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.04 ? t.value * 25 : t.value > 0.9 ? (1 - t.value) * 10 : 1,
    transform: [
      { translateX: drop.x + Math.sin(t.value * Math.PI * 4) * drop.sway },
      { translateY: -30 + t.value * (height + 60) },
      { rotate: `${t.value * drop.spin}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.faller, style]}>
      {kind === 'snow' ? (
        <Snowflake size={drop.size} color="rgba(255,255,255,0.85)" />
      ) : (
        <MapleLeafShape size={drop.size} color={drop.color} />
      )}
    </Animated.View>
  );
}

export function Snowfall({ count = 14 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const drops = useDrops(count, width, 'snow');
  if (useReducedMotion()) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}>
      {drops.map((d, i) => (
        <Faller key={i} drop={d} height={height} kind="snow" />
      ))}
    </View>
  );
}

export function LeafFall({ count = 6 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const drops = useDrops(count, width, 'leaf');
  if (useReducedMotion()) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}>
      {drops.map((d, i) => (
        <Faller key={i} drop={d} height={height} kind="leaf" />
      ))}
    </View>
  );
}

// ── Christmas lights ─────────────────────────────────────────────────────────────────────

const BULBS = ['#F0555A', '#F5C451', '#4FC48A', '#8FD3FF', '#D27BE0'];

function Bulb({ index, color }: { index: number; color: string }) {
  const glow = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    glow.value = withDelay(
      (index % 5) * 380,
      withRepeat(withSequence(withTiming(0.45, { duration: 900 }), withTiming(1, { duration: 900 })), -1)
    );
    return () => cancelAnimation(glow);
  }, [glow, index, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[styles.bulbWrap, style]}>
      <View style={[styles.bulbCap]} />
      <View style={[styles.bulb, { backgroundColor: color, shadowColor: color }]} />
    </Animated.View>
  );
}

/** A gently sagging string of lights across the top of the screen. */
export function StringLights({ top = 0 }: { top?: number }) {
  const { width } = useWindowDimensions();
  const count = Math.max(6, Math.round(width / 44));
  const sag = 14;
  const wire = `M0 2 ${Array.from({ length: count }, (_, i) => {
    const x0 = (i / count) * width;
    const x1 = ((i + 1) / count) * width;
    return `Q ${(x0 + x1) / 2} ${2 + sag} ${x1} 2`;
  }).join(' ')}`;
  return (
    <View pointerEvents="none" style={[styles.lights, { top }]}>
      <Svg width={width} height={sag + 8} style={StyleSheet.absoluteFill}>
        <Path d={wire} stroke="rgba(20,40,30,0.9)" strokeWidth={1.4} fill="none" />
      </Svg>
      {Array.from({ length: count }, (_, i) => {
        const x = ((i + 0.5) / count) * width;
        return (
          <View key={i} style={{ left: x - 4, position: 'absolute', top: 2 + sag * 0.5 }}>
            <Bulb index={i} color={BULBS[i % BULBS.length]!} />
          </View>
        );
      })}
    </View>
  );
}

// ── Characters ───────────────────────────────────────────────────────────────────────────

/** This color's character for the season that's on, floating gently. */
export function SeasonMascot({ size = 56, style, season }: { size?: number; style?: ViewStyle; season?: SeasonId }) {
  const orbit = useOrbitOptional();
  const live = useSeasonal();
  const id = season ?? live.active ?? live.season ?? 'christmas';
  const mascot = SEASON_MASCOT[id][orbit?.accentTheme.id ?? 'coral'];
  const y = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    return () => cancelAnimation(y);
  }, [reduce, y]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { rotate: `${y.value * 0.6}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[float, style]} accessibilityLabel={mascot.name}>
      <Moji name={mascot.moji} size={size} />
    </Animated.View>
  );
}

// ── Mounted pieces ───────────────────────────────────────────────────────────────────────

/** Screen dressing for the main tabs, whichever season is on. */
export function SeasonScreenDecor({ topInset = 0 }: { topInset?: number }) {
  const { active } = useSeasonal();
  if (active === 'halloween') return <HalloweenScreenDecor topInset={topInset} />;
  if (active === 'christmas') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Snowfall />
        <StringLights top={topInset} />
      </View>
    );
  }
  if (active === 'thanksgiving') return <LeafFall />;
  return null;
}

/** A small seasonal touch on a primary button's corner. */
export function SeasonButtonDecor() {
  const { active } = useSeasonal();
  if (active === 'halloween') return <ButtonSpookies />;
  if (active === 'christmas') {
    return (
      <View pointerEvents="none" style={styles.buttonCorner}>
        <Holly size={22} />
      </View>
    );
  }
  if (active === 'thanksgiving') {
    return (
      <View pointerEvents="none" style={[styles.buttonCorner, { transform: [{ rotate: '-24deg' }] }]}>
        <MapleLeafShape size={18} color="#E8703F" />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  faller: { left: 0, position: 'absolute', top: 0 },
  lights: { height: 34, left: 0, position: 'absolute', right: 0 },
  bulbWrap: { alignItems: 'center' },
  bulbCap: { backgroundColor: '#3A4A40', borderRadius: 1, height: 3, width: 4 },
  bulb: {
    borderRadius: 5,
    height: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    width: 7,
  },
  buttonCorner: { left: 6, position: 'absolute', top: -8 },
});

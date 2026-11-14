/**
 * Switch mark — arrows that pass the device round the people on it.
 *
 *   2  ⇄ two opposing arrows      3  a triangle of arrows going round
 *   4  a lozenge (diamond) loop   5–6 a ring of curved arrows
 *
 * Every arrow bows slightly outward and ends in a filled, softly rounded head, so the loop reads
 * as one motion round the group. One person has nothing to switch to: callers show that person's
 * face instead (see setup-kid-device Faces step).
 *
 * `spin` turns the mark once when it appears — used where Switch takes Poppins's place in the tab
 * bar. Skipped when the person has asked for reduced motion.
 */
import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

export { clampSwitchPeopleCount } from '@/lib/household/switch-people-geometry';

type Props = {
  /** How many people share the device (2–6; clamped). */
  count: number;
  size?: number;
  color?: string;
  /** Spin once on mount (and whenever the count changes). */
  spin?: boolean;
};

type Pt = { x: number; y: number };

const r2 = (n: number) => Math.round(n * 1000) / 1000;
const p = (pt: Pt) => `${r2(pt.x)} ${r2(pt.y)}`;

/** Filled arrowhead with its tip at `tip`, pointing along `dir` (unit vector). */
function head(tip: Pt, dir: Pt, len: number, half: number): string {
  const nx = -dir.y;
  const ny = dir.x;
  const base = { x: tip.x - dir.x * len, y: tip.y - dir.y * len };
  const back = { x: tip.x - dir.x * len * 0.78, y: tip.y - dir.y * len * 0.78 }; // notch
  const a = { x: base.x + nx * half, y: base.y + ny * half };
  const b = { x: base.x - nx * half, y: base.y - ny * half };
  return `M ${p(tip)} L ${p(a)} L ${p(back)} L ${p(b)} Z`;
}

function unit(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

type Arrow = { shaft: string; head: string };

/** ⇄ */
function twoArrows(): Arrow[] {
  const len = 0.36;
  const half = 0.22;
  const y = 0.3;
  return [
    // Point-symmetric: the bottom arrow is the top one turned 180° about the centre.
    { shaft: `M -0.74 ${-y} L ${0.74 - len * 0.8} ${-y}`, head: head({ x: 0.74, y: -y }, { x: 1, y: 0 }, len, half) },
    { shaft: `M 0.74 ${y} L ${-0.74 + len * 0.8} ${y}`, head: head({ x: -0.74, y }, { x: -1, y: 0 }, len, half) },
  ];
}

/** Arrows round a polygon (n = 3 triangle, n = 4 lozenge), each bowing outward. */
function polygonLoop(n: number): Arrow[] {
  const R = n === 3 ? 0.84 : 0.86;
  const startDeg = -90; // a corner at the top: triangle points up, square becomes a lozenge
  const verts: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return { x: R * Math.cos(a), y: R * Math.sin(a) }; // centred on the middle, so the spin doesn't wobble
  });
  const gap = n === 3 ? 0.2 : 0.17; // fraction of the edge left open at each corner
  const bow = n === 3 ? 0.16 : 0.13;
  const len = n === 3 ? 0.34 : 0.3;
  const half = n === 3 ? 0.2 : 0.18;
  return verts.map((v, i) => {
    const w = verts[(i + 1) % n];
    const s = { x: v.x + (w.x - v.x) * gap, y: v.y + (w.y - v.y) * gap };
    const e = { x: w.x - (w.x - v.x) * gap, y: w.y - (w.y - v.y) * gap };
    const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    const ml = Math.hypot(mid.x, mid.y) || 1;
    const edgeLen = Math.hypot(e.x - s.x, e.y - s.y);
    const ctrl = { x: mid.x + (mid.x / ml) * bow * edgeLen, y: mid.y + (mid.y / ml) * bow * edgeLen };
    const dir = unit(ctrl, e);
    const shaftEnd = { x: e.x - dir.x * len * 0.7, y: e.y - dir.y * len * 0.7 };
    return { shaft: `M ${p(s)} Q ${p(ctrl)} ${p(shaftEnd)}`, head: head(e, dir, len, half) };
  });
}

/** A ring of n arcs, clockwise, gaps between them. */
function ringLoop(n: number): Arrow[] {
  const R = 0.72;
  const gapDeg = n === 5 ? 22 : 20;
  const span = 360 / n - gapDeg;
  const len = 0.28;
  const half = 0.17;
  const headDeg = (len * 0.7 * 180) / (Math.PI * R);
  const at = (deg: number): Pt => {
    const a = (deg * Math.PI) / 180;
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  };
  return Array.from({ length: n }, (_, i) => {
    const a0 = -90 + (360 / n) * i + gapDeg / 2;
    const a1 = a0 + span;
    const s = at(a0);
    const se = at(a1 - headDeg);
    const tip = at(a1);
    const ta = (a1 * Math.PI) / 180;
    const dir = { x: -Math.sin(ta), y: Math.cos(ta) };
    return {
      shaft: `M ${p(s)} A ${R} ${R} 0 0 1 ${p(se)}`,
      head: head(tip, dir, len, half),
    };
  });
}

export function switchArrows(count: number): Arrow[] {
  const n = Math.max(2, Math.min(6, Math.round(count) || 2));
  if (n === 2) return twoArrows();
  if (n <= 4) return polygonLoop(n);
  return ringLoop(n);
}

export function SwitchPeopleIcon({ count, size = 22, color = '#041018', spin = false }: Props) {
  const arrows = switchArrows(count);
  const stroke = arrows.length <= 3 ? 0.15 : 0.13;
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!spin || reduceMotion) return;
    turn.value = 0;
    turn.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [spin, reduceMotion, count, turn]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, spinStyle]}>
      <Svg
        width={size}
        height={size}
        viewBox="-1 -1 2 2"
        accessibilityLabel={`Switch between ${arrows.length} people`}>
        {arrows.map((arrow, i) => (
          <G key={i}>
            <Path d={arrow.shaft} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
            <Path d={arrow.head} fill={color} stroke={color} strokeWidth={0.04} strokeLinejoin="round" />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

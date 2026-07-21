import Svg, { Circle } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { orbitColors } from '@/constants/orbit-theme';

type MomentumRingProps = {
  /** Make API: 0–1 fractions */
  tasks?: number;
  energy?: number;
  harmony?: number;
  /** Legacy single-score fallback (0–100) */
  score?: number;
  size?: number;
};

const BASE_CONTAINER = 128;
const BASE_OUTER_R = 54;
const BASE_MID_R = 40;
const BASE_INNER_R = 26;
const BASE_STROKE = 10;

/** Make MomentumRing — three concentric rings (tasks / energy / harmony). */
export function MomentumRing({
  tasks,
  energy,
  harmony,
  score = 72,
  size = BASE_CONTAINER,
}: MomentumRingProps) {
  const t = tasks ?? Math.min(1, Math.max(0, score / 100));
  const e = energy ?? Math.min(1, Math.max(0, (score + 8) / 100));
  const h = harmony ?? Math.min(1, Math.max(0, (score - 10) / 100));

  const scale = size / BASE_CONTAINER;
  const stroke = BASE_STROKE * scale;
  const outerR = BASE_OUTER_R * scale;
  const midR = BASE_MID_R * scale;
  const innerR = BASE_INNER_R * scale;
  const cx = size / 2;
  const cy = size / 2;

  const ring = (radius: number, value: number, color: string, track: string) => {
    const c = 2 * Math.PI * radius;
    const offset = c * (1 - value);
    return (
      <>
        <Circle cx={cx} cy={cy} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </>
    );
  };

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {ring(outerR, t, '#38BDF8', 'rgba(56,189,248,0.12)')}
        {ring(midR, e, '#34D399', 'rgba(52,211,153,0.12)')}
        {ring(innerR, h, '#A78BFA', 'rgba(167,139,250,0.12)')}
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.pct, { fontSize: 13 * scale }]}>{Math.round(t * 100)}%</Text>
        <Text style={[styles.label, { fontSize: 9 * scale, lineHeight: 11 * scale }]}>today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    gap: 1,
    justifyContent: 'center',
  },
  label: {
    color: orbitColors.textMuted,
    fontSize: 9,
    lineHeight: 11,
  },
  pct: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
});

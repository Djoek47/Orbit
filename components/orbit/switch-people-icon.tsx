/**
 * Tab-bar Switch mark — N double-arrows, one formation per headcount (2–6).
 *
 *   2  ↔ left–right pair
 *   3  triangle
 *   4  square
 *   5  pentagon
 *   6  hexagon
 */
import Svg, { G, Path } from 'react-native-svg';

import {
  clampSwitchPeopleCount,
  switchArrowAnchors,
} from '@/lib/household/switch-people-geometry';

export { clampSwitchPeopleCount, switchArrowAnchors } from '@/lib/household/switch-people-geometry';

/** One ↔ chevron pair centred at the origin, pointing along +x. */
function doubleArrowPath(scale: number): string {
  const s = scale;
  return [
    `M ${-0.55 * s} ${-0.28 * s}`,
    `L ${-0.15 * s} 0`,
    `L ${-0.55 * s} ${0.28 * s}`,
    `M ${0.55 * s} ${-0.28 * s}`,
    `L ${0.15 * s} 0`,
    `L ${0.55 * s} ${0.28 * s}`,
  ].join(' ');
}

type Props = {
  /** How many people share the tablet (2–6). */
  count: number;
  size?: number;
  color?: string;
};

export function SwitchPeopleIcon({ count, size = 22, color = '#041018' }: Props) {
  const n = clampSwitchPeopleCount(count);
  const anchors = switchArrowAnchors(n);
  const glyph = doubleArrowPath(n <= 3 ? 0.34 : 0.28);

  return (
    <Svg width={size} height={size} viewBox="-1 -1 2 2" accessibilityLabel={`Switch ${n} people`}>
      {anchors.map((anchor, index) => (
        <G
          key={`arrow-${index}`}
          transform={`translate(${anchor.x} ${anchor.y}) rotate(${anchor.angle})`}>
          <Path
            d={glyph}
            stroke={color}
            strokeWidth={0.14}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      ))}
    </Svg>
  );
}

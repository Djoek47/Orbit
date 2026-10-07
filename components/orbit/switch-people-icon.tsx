/**
 * Tab-bar Switch mark — the people on this device, joined into a ring they pass between.
 *
 *   2  ●⇄●        3  triangle       4  square
 *   5  pentagon   6  hexagon
 *
 * Each person is a dot; each edge carries one arrowhead, all going the same way round, so the
 * mark says "move to the next person" rather than just "two arrows". Two people are drawn as
 * two separate one-way lines instead of one line with two heads, which would read as a mistake.
 */
import Svg, { Circle, G, Path } from 'react-native-svg';

import {
  clampSwitchPeopleCount,
  switchDotRadius,
  switchPeopleEdges,
  switchPeopleNodes,
} from '@/lib/household/switch-people-geometry';

export { clampSwitchPeopleCount } from '@/lib/household/switch-people-geometry';

type Props = {
  /** How many people share the device (2–6). */
  count: number;
  size?: number;
  color?: string;
};

/** A single chevron head pointing along +x, drawn at the origin. */
function headPath(scale: number): string {
  const s = scale;
  return `M ${-0.07 * s} ${-0.085 * s} L ${0.03 * s} 0 L ${-0.07 * s} ${0.085 * s}`;
}

export function SwitchPeopleIcon({ count, size = 22, color = '#041018' }: Props) {
  const n = clampSwitchPeopleCount(count);
  const nodes = switchPeopleNodes(n);
  const edges = switchPeopleEdges(n);
  const dot = switchDotRadius(n);
  // Variant B (ship mark): thicker ring than A, brownish stroke vs solid black dots.
  // Six edges still need a slightly finer line or the ring fills in solid at 22px.
  const stroke = n <= 3 ? 0.13 : n <= 4 ? 0.115 : 0.1;
  const head = headPath(n <= 3 ? 1.2 : 1.05);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="-1 -1 2 2"
      accessibilityLabel={`Switch between ${n} people`}>
      {edges.map((edge, index) => (
        <G key={`edge-${index}`}>
          <Path
            d={`M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={0.82}
            fill="none"
          />
          {edge.showHead ? (
            <G transform={`translate(${edge.head.x} ${edge.head.y}) rotate(${edge.angle})`}>
              <Path
                d={head}
                stroke={color}
                strokeWidth={stroke * 1.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={0.9}
              />
            </G>
          ) : null}
        </G>
      ))}

      {/* People last, so the ring passes behind them rather than through them. */}
      {nodes.map((node, index) => (
        <Circle key={`node-${index}`} cx={node.x} cy={node.y} r={dot} fill={color} />
      ))}
    </Svg>
  );
}

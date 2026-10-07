/**
 * The Switch mark: the people on this device, joined into a ring they pass between.
 *
 *   2  two dots, arrows both ways between them
 *   3  triangle      4  square      5  pentagon      6  hexagon
 *
 * The old mark put a separate ↔ at each point of a circle, which at tab-bar size collapsed
 * into a smudge — no shape to read, and nothing connecting anyone to anyone. The shape is the
 * whole idea: a household of three is a triangle, of four a square, and the arrows show that
 * you move around it.
 *
 * All coordinates are in a unit box from -1 to 1, origin at the centre, y pointing down the
 * way SVG does. Pure — safe for node tests without React Native.
 */
import { SHARED_DEVICE_MAX_PEOPLE } from '@/lib/household/shared-device';

export type Point = { x: number; y: number };

export type SwitchEdge = {
  from: Point;
  to: Point;
  /** Degrees, pointing the way round the ring. */
  angle: number;
  /**
   * Whether this edge carries an arrowhead.
   *
   * Five and six heads in a 22px box fill the middle of the ring and the shape stops reading —
   * the thing that made the old mark a smudge. Larger rings put a head on every other edge,
   * which is enough to say which way it turns while leaving the polygon visible.
   */
  head: Point;
  showHead: boolean;
};

export function clampSwitchPeopleCount(count: number): number {
  const n = Math.round(count);
  if (!Number.isFinite(n) || n < 2) return 2;
  return Math.min(SHARED_DEVICE_MAX_PEOPLE, n);
}

/** How big the ring is. Fewer people sit tighter, so two dots never drift to the edges. */
function radiusFor(n: number): number {
  if (n === 2) return 0.5;
  if (n === 3) return 0.58;
  if (n === 4) return 0.56;
  return 0.6;
}

/** How big each person is. Six dots on one ring need to be smaller than three. */
export function switchDotRadius(count: number): number {
  const n = clampSwitchPeopleCount(count);
  if (n <= 3) return 0.15;
  if (n <= 4) return 0.13;
  return 0.115;
}

/**
 * One dot per person, clockwise from the top.
 *
 * Two people sit left and right rather than top and bottom: the gesture is sideways, and a
 * vertical pair reads as a list.
 */
export function switchPeopleNodes(count: number): Point[] {
  const n = clampSwitchPeopleCount(count);
  const r = radiusFor(n);
  if (n === 2) {
    return [
      { x: -r, y: 0 },
      { x: r, y: 0 },
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const deg = -90 + (360 / n) * i;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  });
}

function angleBetween(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

/** Point a fraction of the way from one node to the next. */
function along(from: Point, to: Point, t: number): Point {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/**
 * The edges of the ring, each carrying one arrowhead, all pointing the same way round.
 *
 * Two people are the exception: a single line between them would have to carry two heads
 * pointing opposite ways, which reads as a bug. They get two separate lines instead, offset
 * above and below, each going one way — the ↔ everyone already understands.
 */
export function switchPeopleEdges(count: number): SwitchEdge[] {
  const n = clampSwitchPeopleCount(count);
  const nodes = switchPeopleNodes(n);

  if (n === 2) {
    const [left, right] = nodes as [Point, Point];
    const offset = 0.2;
    const lift = (p: Point, dy: number): Point => ({ x: p.x, y: p.y + dy });
    const outbound = { from: lift(left, -offset), to: lift(right, -offset) };
    const inbound = { from: lift(right, offset), to: lift(left, offset) };
    return [outbound, inbound].map((edge) => ({
      ...edge,
      head: along(edge.from, edge.to, 0.72),
      angle: angleBetween(edge.from, edge.to),
      showHead: true,
    }));
  }

  return nodes.map((from, i) => {
    const to = nodes[(i + 1) % n]!;
    return {
      from,
      to,
      // Past halfway, so the head never sits under the dot it just left.
      head: along(from, to, 0.66),
      angle: angleBetween(from, to),
      // Every edge up to four; every other edge beyond, so the shape stays readable.
      showHead: n <= 4 || i % 2 === 0,
    };
  });
}

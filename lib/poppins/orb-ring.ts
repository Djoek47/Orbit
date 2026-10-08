/**
 * Month ring on the Poppins orb.
 * The diameter stays put. Credit only shortens the stroke, and the gap
 * opens at the top so a half-full month is the bottom half of the ring.
 */

export type MonthRingDash = {
  /** Stroke length along the circle. */
  visible: number;
  /** Gap that completes one revolution. */
  gap: number;
  /** Dash offset that centers the gap at 12 o'clock when the circle starts there. */
  offset: number;
  /** Edge brightness. Empty is fully dark. */
  opacity: number;
};

export function monthRingDash(level: number, radius: number): MonthRingDash {
  'worklet';
  const circ = 2 * Math.PI * Math.max(0, radius);
  const clamped = Number.isNaN(level) ? 0 : Math.min(1, Math.max(0, level));
  if (clamped <= 0.012 || circ <= 0) {
    return { visible: 0, gap: circ, offset: 0, opacity: 0 };
  }
  const full = clamped >= 0.995;
  const visible = full ? circ : clamped * circ;
  const gap = full ? circ : circ - visible;
  // Circle stroke is rotated to start at 12 o'clock. This offset parks the
  // middle of the gap on that point, so the remaining arc sits at the bottom.
  const offset = (visible + circ) / 2;
  const opacity = 0.42 + clamped * 0.58;
  return { visible, gap, offset, opacity };
}

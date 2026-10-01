/**
 * Switch-tab arrow formations (2–6 people).
 * Pure — safe for node tests without React Native.
 */
import { SHARED_DEVICE_MAX_PEOPLE } from '@/lib/household/shared-device';

export function clampSwitchPeopleCount(count: number): number {
  const n = Math.round(count);
  if (!Number.isFinite(n) || n < 2) return 2;
  return Math.min(SHARED_DEVICE_MAX_PEOPLE, n);
}

/** Unit positions on a circle (or the 2-person midline), clockwise from the top. */
export function switchArrowAnchors(count: number): { x: number; y: number; angle: number }[] {
  const n = clampSwitchPeopleCount(count);
  if (n === 2) {
    return [
      { x: -0.42, y: 0, angle: 180 },
      { x: 0.42, y: 0, angle: 0 },
    ];
  }
  const radius = n <= 4 ? 0.42 : 0.48;
  return Array.from({ length: n }, (_, i) => {
    const angle = -90 + (360 / n) * i;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      angle,
    };
  });
}

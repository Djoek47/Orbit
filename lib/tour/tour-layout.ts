/**
 * Pure tour card placement — never leaves the safe area.
 * Work Order 9.3 §3.3.
 */

import type { TourRect } from '@/lib/tour/tour-types';

export type TourCardPlacement = 'above' | 'below' | 'center';

export type PlaceTourCardInput = {
  target: TourRect | null;
  /** Measured via onLayout; 0 on the first frame. */
  cardHeight: number;
  screen: { w: number; h: number };
  insets: { top: number; bottom: number };
  /** Force center (centred steps / no spotlight). */
  forceCenter?: boolean;
};

export type PlaceTourCardResult = {
  top: number;
  placement: TourCardPlacement;
  /** Shrink cutout to a ring when the card must float centered over a large target. */
  ringOnly: boolean;
};

const GAP = 12;
const EDGE = 8;

function clamp(n: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Place the coach card so it is always fully inside the safe area.
 * While cardHeight is 0, still returns a clamped guess using a 200pt stand-in
 * for layout math — callers must render opacity 0 until measured.
 */
export function placeTourCard(input: PlaceTourCardInput): PlaceTourCardResult {
  const { target, screen, insets, forceCenter } = input;
  const cardHeight = input.cardHeight > 0 ? input.cardHeight : 200;
  const minTop = insets.top + EDGE;
  const maxTop = screen.h - insets.bottom - cardHeight - EDGE;
  const centerTop = clamp((screen.h - cardHeight) / 2, minTop, Math.max(minTop, maxTop));

  if (forceCenter || !target || target.width <= 0 || target.height <= 0) {
    return { top: centerTop, placement: 'center', ringOnly: false };
  }

  const targetBottom = target.y + target.height;
  const coversMost = target.height > screen.h * 0.55;
  if (coversMost) {
    return { top: centerTop, placement: 'center', ringOnly: true };
  }

  const spaceBelow = screen.h - insets.bottom - targetBottom - GAP;
  const spaceAbove = target.y - insets.top - GAP;
  const fitsBelow = spaceBelow >= cardHeight;
  const fitsAbove = spaceAbove >= cardHeight;

  if (fitsBelow) {
    return {
      top: clamp(targetBottom + GAP, minTop, Math.max(minTop, maxTop)),
      placement: 'below',
      ringOnly: false,
    };
  }
  if (fitsAbove) {
    return {
      top: clamp(target.y - GAP - cardHeight, minTop, Math.max(minTop, maxTop)),
      placement: 'above',
      ringOnly: false,
    };
  }

  return { top: centerTop, placement: 'center', ringOnly: true };
}

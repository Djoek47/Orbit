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

/** Center (including clamped overflow) always counts as visible for the watchdog. */
export function isTourCardOnScreen(input: {
  placement: TourCardPlacement;
  top: number;
  cardHeight: number;
  screen: { h: number };
  insets: { top: number; bottom: number };
}): boolean {
  if (input.placement === 'center') return true;
  const minTop = input.insets.top + EDGE;
  const maxBottom = input.screen.h - input.insets.bottom - EDGE;
  return input.top >= minTop - 1 && input.top + input.cardHeight <= maxBottom + 1;
}

// ── Exit pill ─────────────────────────────────────────────────────────────────

export type ExitPillPlacement = {
  /** Which side of the screen the pill sits on. */
  side: 'left' | 'right';
  /** Distance from the top of the screen. */
  top: number;
};

/** Roughly how much room the pill needs. */
const EXIT_PILL_W = 108;
const EXIT_PILL_H = 40;
const EXIT_CLEARANCE = 10;

/**
 * Where the Exit pill can sit without covering the thing the tour is pointing at.
 *
 * It used to sit top-right always, which is exactly where the Settings button is — so the step
 * that says "Settings lives here" hid it behind the way out. Now the pill moves: to the other
 * corner when the target is up there, and below the target when it spans the width.
 */
export function placeExitPill(input: {
  target: TourRect | null;
  screen: { w: number; h: number };
  insets: { top: number };
}): ExitPillPlacement {
  const top = input.insets.top + 8;
  const fallback: ExitPillPlacement = { side: 'right', top };
  const { target } = input;
  if (!target) return fallback;

  // Does the target share the pill's band of the screen at all?
  const pillBottom = top + EXIT_PILL_H;
  const sharesBand = target.y < pillBottom + EXIT_CLEARANCE && target.y + target.height > top - EXIT_CLEARANCE;
  if (!sharesBand) return fallback;

  // Right corner is taken — is the left one free?
  const targetLeft = target.x;
  const rightFree = targetLeft > input.screen.w - EXIT_PILL_W - EXIT_CLEARANCE * 2;
  if (rightFree) return fallback;
  const leftFree = target.x + target.width < EXIT_PILL_W + EXIT_CLEARANCE * 2;
  if (leftFree) return { side: 'right', top };
  if (targetLeft > EXIT_PILL_W + EXIT_CLEARANCE * 2) return { side: 'left', top };

  // The target spans the width: drop below it, still inside the screen.
  const below = target.y + target.height + EXIT_CLEARANCE;
  const maxTop = Math.max(top, input.screen.h - EXIT_PILL_H - EXIT_CLEARANCE);
  return { side: 'right', top: Math.min(below, maxTop) };
}

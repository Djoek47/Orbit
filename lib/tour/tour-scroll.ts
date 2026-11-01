/**
 * Where a tour step scrolls its screen to, so the thing it points at lands in the middle of the
 * room that's left — not "roughly there".
 *
 * The old version scrolled to the target's position *on screen* as though the page were at the
 * top. Once the page had been scrolled at all, it landed too high or too low (the Groceries card
 * on Home). This works from the live offset: new offset = offset + (where it is − where it should
 * be), all in window coordinates, which are what the target reports.
 */
import type { TourRect } from '@/lib/tour/tour-types';

/** The app header chips sit over the top of every tab. */
export const TOUR_TOP_CHROME = 84;
/** The floating tab bar sits over the bottom. */
export const TOUR_BOTTOM_CHROME = 96;
/** Room kept for the coach card beside the target. */
export const TOUR_CARD_ROOM = 210;
const GAP = 12;

/** One key per screen the tour visits, from its route. */
export function tourScreenKey(route: string): string {
  const path = (route.split('?')[0] ?? route).replace('/(tabs)', '').replace(/^\/+|\/+$/g, '');
  if (!path || path === 'index') return 'home';
  return path;
}

/** Targets that live in fixed chrome never scroll the page. */
export function targetScrolls(targetId: string): boolean {
  return !(
    targetId.startsWith('tabbar.') ||
    targetId.startsWith('header.') ||
    targetId.startsWith('tour.')
  );
}

/** The visible band a target should sit in, between the header chips and the tab bar. */
export function tourVisibleBand(screenH: number, insets: { top: number; bottom: number }) {
  const top = insets.top + TOUR_TOP_CHROME;
  const bottom = screenH - insets.bottom - TOUR_BOTTOM_CHROME;
  return { top, bottom, height: Math.max(0, bottom - top) };
}

/**
 * The scroll offset that puts `target` (window coordinates) where a coach card still fits next
 * to it, or null when it is already comfortably placed.
 */
export function planTourScroll(input: {
  target: TourRect;
  offset: number;
  screenH: number;
  insets: { top: number; bottom: number };
  cardRoom?: number;
}): number | null {
  const { target, offset } = input;
  const room = input.cardRoom ?? TOUR_CARD_ROOM;
  const band = tourVisibleBand(input.screenH, input.insets);
  const bottom = target.y + target.height;

  const inside = target.y >= band.top && bottom <= band.bottom;
  const roomAbove = target.y - band.top - GAP;
  const roomBelow = band.bottom - bottom - GAP;
  if (inside && (roomAbove >= room || roomBelow >= room)) return null;

  // Target and card, stacked, centred in the band. A target too tall for that sits at the top.
  const stack = target.height + GAP + room;
  const desiredTop =
    stack <= band.height ? band.top + (band.height - stack) / 2 : band.top + 8;
  const next = Math.max(0, offset + (target.y - desiredTop));
  return Math.abs(next - offset) < 4 ? null : Math.round(next);
}

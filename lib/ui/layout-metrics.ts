/**
 * How wide the app's content should be, for a given window.
 *
 * ChoreMaxx was laid out for a phone in portrait. Two things now break that assumption:
 *
 *   iPad          Apple deprecated UIRequiresFullScreen in iPadOS 26, and from the iOS 27 SDK
 *                 it no longer prevents resizing (TN3192). An iPad app is shown in landscape,
 *                 in Split View and in freely resized windows whatever it asks for.
 *   iPhone Duo    the foldable: a 466pt outer screen and a 669pt inner one that iOS treats as
 *                 regular width, like an iPad, and that ignores the orientation lock.
 *
 * So the app has to read well at any width from about 320pt (a narrow Split View slice) to
 * 1366pt (a 13-inch iPad in landscape). Rather than teach three hundred screens about widths,
 * the whole navigator sits in one column: full width wherever a phone layout already fits —
 * which includes the Duo's inner screen — and centred at a comfortable measure beyond that.
 *
 * Pure: no React Native.
 */

/** Full width up to here. The Duo's inner screen (669pt) and every phone fall inside it. */
export const COLUMN_MAX = 720;

/** On very wide windows (iPad landscape) the column breathes a little more. */
export const COLUMN_MAX_WIDE = 840;

/** Windows at least this wide get the wider column. */
export const WIDE_WINDOW = 1100;

export type LayoutClass = 'phone' | 'fold' | 'tablet';

/**
 * phone   under 600pt — every iPhone, the Duo's outer screen, a narrow Split View slice
 * fold    600–899pt — the Duo's inner screen, iPad Slide Over, half of a Split View
 * tablet  900pt and up — iPad full screen, either way round
 */
export function layoutClass(windowWidth: number): LayoutClass {
  if (!Number.isFinite(windowWidth) || windowWidth < 600) return 'phone';
  if (windowWidth < 900) return 'fold';
  return 'tablet';
}

/** The column's width for this window: the window itself, or the cap if the window is wider. */
export function columnWidth(windowWidth: number): number {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return COLUMN_MAX;
  const cap = windowWidth >= WIDE_WINDOW ? COLUMN_MAX_WIDE : COLUMN_MAX;
  return Math.min(windowWidth, cap);
}

/** True when the column is narrower than the window, i.e. there are margins to paint. */
export function isColumnInset(windowWidth: number): boolean {
  return columnWidth(windowWidth) < windowWidth;
}

/**
 * How many tiles fit across, for grids that used to fix their column count.
 *
 * A grid of four on a phone stays four in the column — the column is the point — but this
 * keeps a grid from becoming a row of enormous tiles if it is ever placed outside it.
 */
export function gridColumns(width: number, minTile: number, max: number, min = 1): number {
  if (!Number.isFinite(width) || width <= 0 || minTile <= 0) return min;
  return Math.max(min, Math.min(max, Math.floor(width / minTile)));
}

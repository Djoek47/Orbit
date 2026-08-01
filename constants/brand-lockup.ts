/**
 * Theme-matched Choremaxx lockup colors — logo directions
 * (checkmark + bars mark + chore/maxx wordmark).
 */

import {
  DEFAULT_ACCENT_THEME_ID,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';
import { choremaxxBrand } from '@/constants/choremaxx-brand';

export type BrandLockupColors = {
  /** Rounded mark background */
  markBg: string;
  /** Checkmark fill */
  check: string;
  /** Rising bar fills */
  bars: string;
  /** “chore” wordmark */
  chore: string;
  /** “maxx” wordmark — matches mark primary (blue-arrow rule) */
  maxx: string;
};

const DAY_CHORE = choremaxxBrand.brown;
const NIGHT_CHORE = '#F0DCC8';

const LOCKUPS: Record<AccentThemeId, Omit<BrandLockupColors, 'chore'>> = {
  sky: {
    markBg: '#378ADD',
    check: '#FFFFFF',
    bars: '#FAC775',
    maxx: '#378ADD',
  },
  citrus: {
    markBg: '#EF9F27',
    check: '#712B13',
    bars: '#FFFFFF',
    maxx: '#EF9F27',
  },
  coral: {
    markBg: '#D85A30',
    check: '#FFFFFF',
    bars: '#FAC775',
    maxx: '#D85A30',
  },
  berry: {
    markBg: '#7F77DD',
    check: '#FFFFFF',
    bars: '#F4C0D1',
    maxx: '#7F77DD',
  },
};

/** Resolve mark + wordmark colors for the active palette / appearance. */
export function resolveBrandLockup(
  paletteId?: string | null,
  isDark = false
): BrandLockupColors {
  const id = migrateAccentThemeId(paletteId ?? DEFAULT_ACCENT_THEME_ID);
  const base = LOCKUPS[id] ?? LOCKUPS.coral;
  return {
    ...base,
    chore: isDark ? NIGHT_CHORE : DAY_CHORE,
  };
}

export const DEFAULT_BRAND_LOCKUP = resolveBrandLockup(DEFAULT_ACCENT_THEME_ID, false);

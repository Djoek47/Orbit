/**
 * Theme-matched Choremaxx lockup — house mark + chore/maxx wordmark.
 * Both wordmark halves follow the active palette (not a fixed brown chore).
 */

import {
  DEFAULT_ACCENT_THEME_ID,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';

export type BrandLockupColors = {
  /** House roof stroke */
  roof: string;
  /** House body fill */
  body: string;
  /** Sparkle / accent above the roof */
  sparkle: string;
  /** “chore” wordmark — theme secondary */
  chore: string;
  /** “maxx” wordmark — theme primary */
  maxx: string;
  /** Soft wash for glows / splash halos */
  wash: string;
};

type LockupBase = BrandLockupColors;

const LOCKUPS: Record<AccentThemeId, LockupBase> = {
  sky: {
    roof: '#378ADD',
    body: '#5BADE8',
    sparkle: '#FAC775',
    chore: '#C4922A',
    maxx: '#378ADD',
    wash: '#378ADD',
  },
  citrus: {
    roof: '#EF9F27',
    body: '#F5C56B',
    sparkle: '#712B13',
    chore: '#712B13',
    maxx: '#EF9F27',
    wash: '#EF9F27',
  },
  coral: {
    roof: '#D85A30',
    body: '#E88B5C',
    sparkle: '#FAC775',
    chore: '#C4922A',
    maxx: '#D85A30',
    wash: '#D85A30',
  },
  berry: {
    roof: '#7F77DD',
    body: '#A49AE8',
    sparkle: '#F4C0D1',
    chore: '#C4789A',
    maxx: '#7F77DD',
    wash: '#7F77DD',
  },
};

/** Night: bright theme secondaries so “chore” reads on dark glass. */
const NIGHT_CHORE: Record<AccentThemeId, string> = {
  sky: '#FAC775',
  citrus: '#F0DCC8',
  coral: '#FAC775',
  berry: '#F4C0D1',
};

/** Resolve house + wordmark colors for the active palette / appearance. */
export function resolveBrandLockup(
  paletteId?: string | null,
  isDark = false
): BrandLockupColors {
  const id = migrateAccentThemeId(paletteId ?? DEFAULT_ACCENT_THEME_ID);
  const base = LOCKUPS[id] ?? LOCKUPS.coral;
  return {
    ...base,
    chore: isDark ? NIGHT_CHORE[id] ?? base.chore : base.chore,
  };
}

export const DEFAULT_BRAND_LOCKUP = resolveBrandLockup(DEFAULT_ACCENT_THEME_ID, false);

/** @deprecated Alias kept for older checkmark-era call sites. */
export type BrandLockupColorsLegacy = BrandLockupColors & {
  markBg: string;
  check: string;
  bars: string;
};

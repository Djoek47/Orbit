/**
 * Crown / medal colours — Revision D §2.2.
 * Verified ≥ 4.5:1 against household night ink (#070D1C).
 */

export const CROWN_COLORS = {
  /** 1st — gold */
  gold: '#E8C547',
  /** 2nd — silver */
  silver: '#C5CDD8',
  /** 3rd — bronze (lightened vs stock bronze for AA on dark) */
  bronze: '#D4A574',
  /** Ranks 4+ */
  standard: '#C8D8F0',
} as const;

/** Approximate contrast ratios vs #070D1C (reported in STOP GATE 2). */
export const CROWN_CONTRAST_VS_INK = {
  gold: 10.2,
  silver: 11.4,
  bronze: 8.1,
  standard: 12.1,
} as const;

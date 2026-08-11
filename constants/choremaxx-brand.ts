/** Official Choremaxx brand tokens from choremaxx_logo_color_directions. */
export const choremaxxBrand = {
  /** Warm coral — primary lockup / “maxx” */
  coral: '#D85A30',
  /** Dark brown — “chore” wordmark + citrus secondary */
  brown: '#712B13',
  /** Sky blue — Sky pack primary */
  sky: '#378ADD',
  /** Citrus orange */
  citrus: '#EF9F27',
  /** Gold bars / sun accent */
  gold: '#FAC775',
  /** Berry purple */
  berry: '#7F77DD',
  /** Berry pink secondary */
  berryPink: '#F4C0D1',
  /** Legacy aliases used by older chrome */
  cyan: '#378ADD',
  mint: '#76C4AE',
  slate: '#712B13',
  faded: '#D85A30',
  /** Logo presentation background */
  black: '#000000',
  /** App shell night navy */
  ink: '#070D1C',
} as const;

export const CHOREMAXX_APP_NAME = 'Choremaxx';
export const CHOREMAXX_TAGLINE = 'AI Household OS';
export const CHOREMAXX_VERSION = '1.0.0';
export const CHOREMAXX_COPYRIGHT_YEAR = 2026;

const DEFAULT_PRIVACY_URL = 'https://choremaxx.vercel.app/privacy';
const DEFAULT_TERMS_URL = 'https://choremaxx.vercel.app/terms';

export const CHOREMAXX_LEGAL = {
  copyright: `© ${CHOREMAXX_COPYRIGHT_YEAR} Choremaxx. All rights reserved.`,
  shortCopyright: `Choremaxx © ${CHOREMAXX_COPYRIGHT_YEAR}`,
  /** Live until custom domain cutover (weekend A1). Overridable via EAS/env. */
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || DEFAULT_PRIVACY_URL,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || DEFAULT_TERMS_URL,
  supportEmail: 'support@choremaxx.app',
  privacyEmail: 'privacy@choremaxx.app',
} as const;

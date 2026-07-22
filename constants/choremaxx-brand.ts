/** Official Choremaxx brand tokens from the primary logo lockup. */
export const choremaxxBrand = {
  /** Cyan / sky — roof + “chorema” */
  cyan: '#59B2E1',
  /** Mint / teal — icon base ribbon */
  mint: '#76C4AE',
  /** Gold sparkle */
  gold: '#FFD700',
  /** First “x” */
  slate: '#4A6984',
  /** Second “x” (lighter / faded) */
  faded: '#8BB8D4',
  /** Logo presentation background */
  black: '#000000',
  /** App shell stays on Orbit night navy for UI chrome */
  ink: '#070D1C',
} as const;

export const CHOREMAXX_APP_NAME = 'Choremaxx';
export const CHOREMAXX_TAGLINE = 'AI Household OS';
export const CHOREMAXX_VERSION = '1.0.0';
export const CHOREMAXX_COPYRIGHT_YEAR = 2026;

export const CHOREMAXX_LEGAL = {
  copyright: `© ${CHOREMAXX_COPYRIGHT_YEAR} Choremaxx. All rights reserved.`,
  shortCopyright: `Choremaxx © ${CHOREMAXX_COPYRIGHT_YEAR}`,
  privacyUrl: 'https://choremaxx.app/privacy',
  termsUrl: 'https://choremaxx.app/terms',
  supportEmail: 'support@choremaxx.app',
  privacyEmail: 'privacy@choremaxx.app',
} as const;

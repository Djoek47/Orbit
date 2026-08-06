/**
 * Choremaxx transactional email design tokens.
 *
 * Emails always use the fixed coral/cream ChoreMaxx brand identity (the
 * logo lockup), independent of a household's in-app accent theme (Sky /
 * Citrus / Coral / Berry). `coral`, `brown`, and `cream` mirror
 * `constants/choremaxx-brand.ts`; `accent` and `bg` are email-only tokens
 * from the brand spec that don't exist in the in-app theme.
 */

export const emailColors = {
  /** Primary — "maxx" wordmark, primary buttons, app icon. */
  coral: '#D85A30',
  /** Pressed / hover state for coral buttons. */
  coralPressed: '#C84D28',
  /** Accent — secondary CTAs, links, highlights. */
  accent: '#E4552B',
  /** Dark text — "chore" wordmark, headlines. */
  darkText: '#712B13',
  /** Cream — checkmark/chart mark, subtle highlight fills. */
  cream: '#FAC775',
  /** Page background outside the card. */
  bg: '#F7F4F2',
  /** Card background. */
  card: '#FFFFFF',
  /** Hairline dividers. */
  divider: '#ECE6E2',
  /** Body copy. */
  body: '#3A2E28',
  /** Muted / caption copy. */
  muted: '#8A7A70',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF453A',
} as const;

export const emailFontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const emailType = {
  title: { fontSize: '34px', lineHeight: '40px', fontWeight: 650 },
  heading: { fontSize: '26px', lineHeight: '32px', fontWeight: 650 },
  body: { fontSize: '17px', lineHeight: '26px', fontWeight: 400 },
  caption: { fontSize: '13px', lineHeight: '18px', fontWeight: 500 },
} as const;

export const emailSpace = {
  outer: 48,
  inner: 32,
} as const;

export const emailRadius = {
  card: 24,
  button: 16,
} as const;

/**
 * Public logo URL. Email clients cannot load bundled Expo assets — host the
 * mark PNG (`assets/brand/choremaxx-logo-mark.png`) somewhere public (a
 * Supabase Storage public bucket, or `https://choremaxx.app/emails/logo.png`
 * once the marketing site can serve it) and set this before sending.
 *
 * TODO(wiring): replace with the real hosted URL.
 */
export const EMAIL_LOGO_URL = 'https://choremaxx.app/emails/logo-mark.png';

export const EMAIL_TAGLINE = 'AI Household Operating System';

export const EMAIL_LINKS = {
  website: 'https://choremaxx.app',
  manageAccount: 'https://choremaxx.app/account',
  privacy: 'https://choremaxx.app/privacy',
  terms: 'https://choremaxx.app/terms',
  support: 'support@choremaxx.app',
} as const;

export const EMAIL_COPYRIGHT = `© ${new Date().getFullYear()} ChoreMaxx. Made for happier homes.`;

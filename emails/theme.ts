/**
 * Choremaxx transactional email design tokens.
 *
 * Logo = official coral house mark (same as app / website).
 * Type = Bricolage Grotesque — same family as the in-app confirm-email screen
 * (`AppText` / `FontFamily`). Clients without web fonts fall back to system UI.
 *
 * Colors stay on the fixed coral brand plate (independent of in-app palette).
 */

/** Official house mark on cream plate — hosted from the Orbit shipping tip. */
export const EMAIL_LOGO_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-logo-mark.png';

/** Square avatar for Gravatar / Apple Branded Mail / BIMI prep. */
export const EMAIL_SENDER_AVATAR_URL =
  'https://raw.githubusercontent.com/Djoek47/Orbit/cursor/choremaxx-make-v10-5f8f/assets/brand/choremaxx-email-avatar.png';

/**
 * Prefer marketing host once Vercel serves the house mark
 * (`public/emails/logo-mark.png`). Until then GitHub raw above is authoritative.
 */
export const EMAIL_LOGO_URL_SITE = 'https://www.choremaxx.app/emails/logo-mark.png';

export const emailColors = {
  /** “maxx” + primary buttons — coral lockup */
  coral: '#D85A30',
  coralPressed: '#C84D28',
  accent: '#E4552B',
  /** “chore” wordmark — coral lockup secondary gold */
  chore: '#C4922A',
  /** Headlines / dark text */
  darkText: '#0F0E17',
  cream: '#FAC775',
  bg: '#F7F4F2',
  card: '#FFFFFF',
  divider: '#ECE6E2',
  body: '#3D3A4E',
  muted: '#8B8AA0',
  success: '#34C759',
  warning: '#FF9F0A',
  danger: '#FF453A',
} as const;

/** Matches app confirm screen — Bricolage Grotesque with system fallbacks. */
export const emailFontStack =
  '"Bricolage Grotesque", BricolageGrotesque, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif';

/** Google Fonts import for clients that allow web fonts (Apple Mail, etc.). */
export const EMAIL_FONT_IMPORT =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap';

export const emailType = {
  /** Align with `typography.title1` (28 / Bold) on confirm-email */
  title: { fontSize: '28px', lineHeight: '34px', fontWeight: 700 },
  heading: { fontSize: '22px', lineHeight: '28px', fontWeight: 700 },
  body: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
  caption: { fontSize: '13px', lineHeight: '18px', fontWeight: 500 },
  /** Wordmark size near AuthShell brandHero (`ChoremaxxLogo` lg ≈ 34) */
  wordmark: { fontSize: '28px', lineHeight: '32px', fontWeight: 800 },
} as const;

export const emailSpace = {
  outer: 48,
  inner: 32,
} as const;

export const emailRadius = {
  card: 24,
  button: 16,
  logo: 18,
} as const;

export const EMAIL_TAGLINE = 'AI Household OS';

export const EMAIL_LINKS = {
  website: 'https://www.choremaxx.app',
  manageAccount: 'https://www.choremaxx.app',
  privacy: 'https://www.choremaxx.app/privacy',
  terms: 'https://www.choremaxx.app/terms',
  support: 'support@choremaxx.app',
} as const;

export const EMAIL_COPYRIGHT = `© ${new Date().getFullYear()} ChoreMaxx. Made for happier homes.`;

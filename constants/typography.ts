/**
 * ChoreMaxx typeface tokens — Bricolage Grotesque only.
 *
 * PostScript names (verified from TTF name table id 6):
 *   BricolageGrotesque-Regular
 *   BricolageGrotesque-Medium
 *   BricolageGrotesque-SemiBold
 *   BricolageGrotesque-Bold
 *   BricolageGrotesque-ExtraBold
 *
 * Upstream ships the general-purpose optical cut without a `_48pt` filename
 * suffix (12pt / 96pt siblings exist separately). These five files are that cut.
 *
 * Android: never rely on `fontWeight` with custom fonts — map weight → family.
 * Do not put raw font-family strings elsewhere; import from here.
 *
 * Asset `require()` map lives in `constants/bricolage-font-assets.ts` (loaded
 * only from root layout via `useFonts`).
 */

import type { TextStyle } from 'react-native';

export const FontFamily = {
  regular: 'BricolageGrotesque-Regular',
  medium: 'BricolageGrotesque-Medium',
  semiBold: 'BricolageGrotesque-SemiBold',
  bold: 'BricolageGrotesque-Bold',
  extraBold: 'BricolageGrotesque-ExtraBold',
} as const;

export type FontFamilyName = (typeof FontFamily)[keyof typeof FontFamily];

/**
 * Map CSS/RN fontWeight → Bricolage family (Android-safe).
 * 400 Regular · 500 Medium · 600 SemiBold · 700 Bold · 800/900 ExtraBold
 */
export function fontFamilyForWeight(
  weight?: TextStyle['fontWeight'] | null
): FontFamilyName {
  const raw = weight == null ? '400' : String(weight);
  const normalized = raw === 'normal' ? '400' : raw === 'bold' ? '700' : raw;
  const n = Number.parseInt(normalized, 10);
  if (!Number.isFinite(n) || n <= 400) return FontFamily.regular;
  if (n <= 500) return FontFamily.medium;
  if (n <= 600) return FontFamily.semiBold;
  if (n <= 700) return FontFamily.bold;
  return FontFamily.extraBold;
}

/**
 * Resolve a style (or style array leaf) to Bricolage: set `fontFamily` from
 * weight (or existing family token) and strip `fontWeight` for Android.
 * Size / lineHeight / letterSpacing are left untouched.
 */
export function applyBricolageFont(style?: TextStyle | null): TextStyle {
  if (!style) {
    return { fontFamily: FontFamily.regular };
  }
  const { fontWeight, fontFamily: existingFamily, ...rest } = style;
  // Prefer explicit fontWeight remap (Android). Otherwise keep a known family token.
  const family =
    fontWeight != null
      ? fontFamilyForWeight(fontWeight)
      : existingFamily && Object.values(FontFamily).includes(existingFamily as FontFamilyName)
        ? (existingFamily as FontFamilyName)
        : FontFamily.regular;
  return {
    ...rest,
    fontFamily: family,
  };
}

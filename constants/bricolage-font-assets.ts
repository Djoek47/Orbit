/**
 * Expo `useFonts` asset map for Bricolage Grotesque.
 * Keys MUST match PostScript / `FontFamily` names in `constants/typography.ts`.
 */
import { FontFamily } from '@/constants/typography';

export const BRICOLAGE_FONT_MAP = {
  [FontFamily.regular]: require('../assets/fonts/BricolageGrotesque-Regular.ttf'),
  [FontFamily.medium]: require('../assets/fonts/BricolageGrotesque-Medium.ttf'),
  [FontFamily.semiBold]: require('../assets/fonts/BricolageGrotesque-SemiBold.ttf'),
  [FontFamily.bold]: require('../assets/fonts/BricolageGrotesque-Bold.ttf'),
  [FontFamily.extraBold]: require('../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
} as const;

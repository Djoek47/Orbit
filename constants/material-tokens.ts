import { Platform } from 'react-native';

/**
 * Material tiers for `expo-blur`'s `BlurView` — see
 * `docs/design-system/02-design-language.md` §6 and
 * `docs/design-system/08-liquid-glass-guidelines.md`.
 *
 * Rule: glass is navigation/chrome/floating-controls/overlays/sheets/search.
 * Glass is never content (cards, list rows, modal bodies stay flat `surface.*`
 * colors from `orbitColors` / background theme packs).
 */
export type MaterialTier = 'liquidGlass' | 'ultraThin' | 'thin' | 'opaque';

type MaterialSpec = {
  /** iOS `BlurView` intensity (0-100). */
  intensity: number;
  /** Android fallback intensity — Android blur is visually weaker at equal values. */
  androidIntensity: number;
};

export const material: Record<Exclude<MaterialTier, 'opaque'>, MaterialSpec> = {
  /** Floating tab bar, expanded search field, FAB — the hero floating moments. */
  liquidGlass: { intensity: 45, androidIntensity: 90 },
  /** Sticky section headers while scrolling, bottom-sheet backgrounds. */
  ultraThin: { intensity: 25, androidIntensity: 60 },
  /** Context menus, secondary inline toolbars. */
  thin: { intensity: 15, androidIntensity: 40 },
};

/** `BlurView` tint resolves per current appearance — pass through, never hardcode. */
export function resolveBlurTint(isDark: boolean): 'systemChromeMaterialDark' | 'systemChromeMaterialLight' | 'dark' | 'light' {
  if (Platform.OS === 'ios') {
    return isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';
  }
  return isDark ? 'dark' : 'light';
}

/** Android needs the experimental blur method for anything resembling real blur. */
export const androidBlurMethod = Platform.OS === 'android' ? 'dimezisBlurView' : undefined;

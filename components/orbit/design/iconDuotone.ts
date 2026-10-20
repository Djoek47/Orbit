/**
 * Theme-matched duotone for the ChoreMaxx Icon set only.
 * Sky / Citrus / Coral / Berry — same board hexes as accent packs.
 * Does not touch house logo, app icons, or MaterialIcons.
 */
import {
  DEFAULT_ACCENT_THEME_ID,
  getAccentTheme,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';

export type IconDuotone = {
  /** Majority stroke — board secondary */
  body: string;
  /** Highlight detail — board primary */
  accent: string;
};

/** On dark glass, lift citrus brown so body strokes stay readable. */
const NIGHT_BODY: Partial<Record<AccentThemeId, string>> = {
  citrus: '#F0DCC8',
};

/**
 * Board pairs (check+bars directions):
 * Sky    gold + blue · Citrus brown + citrus · Coral gold + coral · Berry pink + berry
 */
export function resolveIconDuotone(
  paletteId?: string | null,
  isDark = false,
): IconDuotone {
  const id = migrateAccentThemeId(paletteId ?? DEFAULT_ACCENT_THEME_ID);
  const theme = getAccentTheme(id);
  const body = isDark && NIGHT_BODY[id] ? NIGHT_BODY[id]! : theme.secondary;
  return { body, accent: theme.primary };
}

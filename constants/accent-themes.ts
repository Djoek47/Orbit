/**
 * Personal accent-color packs — fills the `accent.primary`/`accent.secondary`
 * roles from `docs/design-system/02-design-language.md` §1.3. Domain colors
 * (rewardsGold/poppinsCyan/planPurple in `orbit-theme.ts`) stay fixed regardless
 * of which pack is active.
 *
 * Logo directions (`choremaxx_logo_color_directions`): Sky, Citrus, Coral, Berry.
 */
export type AccentThemeId = 'sky' | 'citrus' | 'coral' | 'berry';

/** Legacy Make / Design-8 ids still found in AsyncStorage or mock data. */
export type LegacyAccentThemeId =
  | 'ocean'
  | 'aurora'
  | 'cosmic'
  | 'sunset'
  | 'rose'
  | 'forest'
  | 'slate'
  | 'amber'
  | 'violet';

export type AccentTypeStyle = {
  /** Short vibe label shown in Settings. */
  label: string;
  titleWeight: '600' | '700' | '800';
  captionWeight: '500' | '600' | '700';
  letterSpacing: number;
};

export type AccentTheme = {
  id: AccentThemeId;
  label: string;
  primary: string;
  secondary: string;
  typeStyle: AccentTypeStyle;
};

const TYPE_CALM: AccentTypeStyle = {
  label: 'Calm',
  titleWeight: '600',
  captionWeight: '500',
  letterSpacing: -0.2,
};

const TYPE_BOLD: AccentTypeStyle = {
  label: 'Bold',
  titleWeight: '800',
  captionWeight: '700',
  letterSpacing: -0.45,
};

const TYPE_SOFT: AccentTypeStyle = {
  label: 'Soft',
  titleWeight: '700',
  captionWeight: '600',
  letterSpacing: 0.15,
};

const TYPE_CRISP: AccentTypeStyle = {
  label: 'Crisp',
  titleWeight: '700',
  captionWeight: '600',
  letterSpacing: -0.55,
};

/** Accent themes — logo color directions. */
export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'sky', label: 'Sky', primary: '#378ADD', secondary: '#FAC775', typeStyle: TYPE_CALM },
  { id: 'citrus', label: 'Citrus', primary: '#EF9F27', secondary: '#712B13', typeStyle: TYPE_CRISP },
  { id: 'coral', label: 'Coral', primary: '#D85A30', secondary: '#FAC775', typeStyle: TYPE_BOLD },
  { id: 'berry', label: 'Berry', primary: '#7F77DD', secondary: '#F4C0D1', typeStyle: TYPE_SOFT },
];

export const DEFAULT_ACCENT_THEME_ID: AccentThemeId = 'coral';

const THEME_IDS = new Set<string>(ACCENT_THEMES.map((theme) => theme.id));

/** Map Design-8 / older accent ids onto the four logo packs. */
export const LEGACY_ACCENT_TO_PALETTE: Record<string, AccentThemeId> = {
  ocean: 'sky',
  aurora: 'sky',
  forest: 'sky',
  sunset: 'coral',
  amber: 'citrus',
  slate: 'citrus',
  cosmic: 'berry',
  rose: 'berry',
  violet: 'berry',
  sky: 'sky',
  citrus: 'citrus',
  coral: 'coral',
  berry: 'berry',
};

export function migrateAccentThemeId(value: string | null | undefined): AccentThemeId {
  if (!value) return DEFAULT_ACCENT_THEME_ID;
  if (THEME_IDS.has(value)) return value as AccentThemeId;
  return LEGACY_ACCENT_TO_PALETTE[value] ?? DEFAULT_ACCENT_THEME_ID;
}

export function isAccentThemeId(value: string | null | undefined): value is AccentThemeId {
  return Boolean(value && THEME_IDS.has(value));
}

/** True if value is a current or migratable legacy accent id. */
export function isResolvableAccentThemeId(value: string | null | undefined): boolean {
  return Boolean(value && (THEME_IDS.has(value) || value in LEGACY_ACCENT_TO_PALETTE));
}

export function getAccentTheme(id?: string | null): AccentTheme {
  const resolved = migrateAccentThemeId(id);
  return ACCENT_THEMES.find((theme) => theme.id === resolved) ?? ACCENT_THEMES[2]!;
}

/** Make AdminScreen avatar emoji catalog (+ expanded faces/pets/objects). */
export const AVATAR_EMOJIS = [
  '👩',
  '👨',
  '🧑',
  '👧',
  '👦',
  '👵',
  '👴',
  '🌟',
  '🦋',
  '🌙',
  '⭐',
  '🦊',
  '🐬',
  '🐶',
  '🐱',
  '🐼',
  '🦁',
  '🐧',
  '🦄',
  '🌺',
  '🎯',
  '🚀',
  '🎸',
  '🌈',
  '🎨',
  '😎',
  '🥳',
  '🤩',
  '😇',
  '🔥',
  '💎',
  '🎮',
] as const;

/** Room emoji catalog for Settings + onboarding create flows. */
export const ROOM_EMOJIS = [
  '🚪',
  '🍳',
  '🛋️',
  '🚿',
  '🛏️',
  '👕',
  '🪴',
  '🧹',
  '🚗',
  '💼',
  '🧸',
  '🌳',
  '🏋️',
  '🫙',
  '🌅',
  '📺',
  '🧺',
  '🛠️',
] as const;

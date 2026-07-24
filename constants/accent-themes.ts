export type AccentThemeId =
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

/** Accent themes — personal look (color + type vibe). */
export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'ocean', label: 'Ocean', primary: '#59B2E1', secondary: '#3A9BC8', typeStyle: TYPE_CALM },
  { id: 'aurora', label: 'Aurora', primary: '#76C4AE', secondary: '#4FA88F', typeStyle: TYPE_SOFT },
  { id: 'cosmic', label: 'Cosmic', primary: '#A78BFA', secondary: '#7C3AED', typeStyle: TYPE_BOLD },
  { id: 'sunset', label: 'Sunset', primary: '#FB923C', secondary: '#EA580C', typeStyle: TYPE_CRISP },
  { id: 'rose', label: 'Rose', primary: '#F472B6', secondary: '#EC4899', typeStyle: TYPE_SOFT },
  { id: 'forest', label: 'Forest', primary: '#34D399', secondary: '#059669', typeStyle: TYPE_CALM },
  { id: 'slate', label: 'Slate', primary: '#94A3B8', secondary: '#64748B', typeStyle: TYPE_CRISP },
  { id: 'amber', label: 'Amber', primary: '#FBBF24', secondary: '#D97706', typeStyle: TYPE_BOLD },
  { id: 'violet', label: 'Violet', primary: '#8B5CF6', secondary: '#6D28D9', typeStyle: TYPE_BOLD },
];

export const DEFAULT_ACCENT_THEME_ID: AccentThemeId = 'ocean';

const THEME_IDS = new Set<string>(ACCENT_THEMES.map((theme) => theme.id));

export function isAccentThemeId(value: string | null | undefined): value is AccentThemeId {
  return Boolean(value && THEME_IDS.has(value));
}

export function getAccentTheme(id?: string | null): AccentTheme {
  return ACCENT_THEMES.find((theme) => theme.id === id) ?? ACCENT_THEMES[0];
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

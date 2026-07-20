export type AccentThemeId = 'ocean' | 'aurora' | 'cosmic' | 'sunset' | 'rose';

export type AccentTheme = {
  id: AccentThemeId;
  label: string;
  primary: string;
  secondary: string;
};

/** Make AdminScreen ACCENT_THEMES — app-wide primary tint. */
export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'ocean', label: 'Ocean', primary: '#59B2E1', secondary: '#3A9BC8' },
  { id: 'aurora', label: 'Aurora', primary: '#76C4AE', secondary: '#4FA88F' },
  { id: 'cosmic', label: 'Cosmic', primary: '#A78BFA', secondary: '#7C3AED' },
  { id: 'sunset', label: 'Sunset', primary: '#FB923C', secondary: '#EA580C' },
  { id: 'rose', label: 'Rose', primary: '#F472B6', secondary: '#EC4899' },
];

export const DEFAULT_ACCENT_THEME_ID: AccentThemeId = 'ocean';

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

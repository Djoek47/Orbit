/**
 * Curated background packs — readable text contrast, pairs with accent tints.
 * Each pack supplies its own base/elevated/recessed triad per
 * `docs/design-system/02-design-language.md` §1.1; this is the contract those
 * three background/backgroundSoft/shell fields must satisfy.
 */

export type BackgroundThemeId = 'midnight' | 'dusk' | 'paper' | 'mist' | 'contrast';

export type BackgroundTheme = {
  id: BackgroundThemeId;
  label: string;
  /** dark | light — which appearance this pack targets when System resolves */
  base: 'dark' | 'light';
  background: string;
  backgroundSoft: string;
  shell: string;
  card: string;
  cardStrong: string;
  border: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textSubtle: string;
  textFaint: string;
  tabInactive: string;
  ink: string;
  /** Swatch shown in Settings */
  preview: [string, string];
};

export const DEFAULT_BACKGROUND_THEME_ID: BackgroundThemeId = 'midnight';

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    base: 'dark',
    background: '#070D1C',
    backgroundSoft: '#0A1525',
    shell: '#030810',
    card: 'rgba(255, 255, 255, 0.05)',
    cardStrong: 'rgba(255, 255, 255, 0.07)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#EEF2FF',
    textSoft: '#C8D8F0',
    textMuted: '#7C9CC0',
    textSubtle: '#4B6080',
    textFaint: '#2A3A54',
    tabInactive: '#3A5070',
    ink: '#070D1C',
    preview: ['#070D1C', '#0A1525'],
  },
  {
    id: 'dusk',
    label: 'Dusk',
    base: 'dark',
    background: '#12101A',
    backgroundSoft: '#1A1628',
    shell: '#0C0A12',
    card: 'rgba(255, 255, 255, 0.06)',
    cardStrong: 'rgba(255, 255, 255, 0.09)',
    border: 'rgba(167, 139, 250, 0.18)',
    text: '#F5F0FF',
    textSoft: '#D4CBE8',
    textMuted: '#9B8FBF',
    textSubtle: '#6B6288',
    textFaint: '#3D3654',
    tabInactive: '#5A5270',
    ink: '#12101A',
    preview: ['#12101A', '#1A1628'],
  },
  {
    id: 'paper',
    label: 'Paper',
    base: 'light',
    background: '#F7F4EE',
    backgroundSoft: '#EFEAE0',
    shell: '#E8E2D6',
    card: 'rgba(255, 255, 255, 0.72)',
    cardStrong: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(40, 36, 28, 0.1)',
    text: '#1A1814',
    textSoft: '#3D3830',
    textMuted: '#6B6458',
    textSubtle: '#8A8274',
    textFaint: '#B0A898',
    tabInactive: '#9A9284',
    ink: '#1A1814',
    preview: ['#F7F4EE', '#EFEAE0'],
  },
  {
    id: 'mist',
    label: 'Mist',
    base: 'light',
    background: '#F0F4F8',
    backgroundSoft: '#E4EBF2',
    shell: '#D8E2EC',
    card: 'rgba(255, 255, 255, 0.78)',
    cardStrong: 'rgba(255, 255, 255, 0.92)',
    border: 'rgba(20, 40, 60, 0.1)',
    text: '#0F1C2A',
    textSoft: '#2A3A4C',
    textMuted: '#5A6E82',
    textSubtle: '#7A8FA3',
    textFaint: '#A0B0C0',
    tabInactive: '#8A9CB0',
    ink: '#0F1C2A',
    preview: ['#F0F4F8', '#E4EBF2'],
  },
  {
    id: 'contrast',
    label: 'Contrast',
    base: 'dark',
    background: '#000000',
    backgroundSoft: '#111111',
    shell: '#000000',
    card: 'rgba(255, 255, 255, 0.08)',
    cardStrong: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.16)',
    text: '#FFFFFF',
    textSoft: '#E8E8E8',
    textMuted: '#A0A0A0',
    textSubtle: '#707070',
    textFaint: '#404040',
    tabInactive: '#808080',
    ink: '#000000',
    preview: ['#000000', '#222222'],
  },
];

export function isBackgroundThemeId(value: string | null | undefined): value is BackgroundThemeId {
  return BACKGROUND_THEMES.some((theme) => theme.id === value);
}

export function getBackgroundTheme(id: string | null | undefined): BackgroundTheme {
  return BACKGROUND_THEMES.find((theme) => theme.id === id) ?? BACKGROUND_THEMES[0]!;
}

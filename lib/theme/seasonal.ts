/**
 * Seasonal themes laid over the four color palettes: Halloween, Thanksgiving (US) and Christmas.
 *
 * - Each season has its own released flag and its own window (local time). Outside the window
 *   the season does not exist: no card, no Settings row, no decorations.
 *     Halloween     Oct 1 → Nov 1
 *     Thanksgiving  Nov 1 → the Monday after US Thanksgiving (4th Thursday of November)
 *     Christmas     that Monday → Jan 7 (so it carries through New Year and Epiphany)
 *   The windows never overlap, so at most one season is in the air at a time.
 * - The member opts in per season from its "… is here" card (Home / Activity) or Settings.
 * - Off = the normal app, untouched: same palette, same logo, no decorations.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { MojiName } from '@/components/orbit/moji/art';
import type { AccentThemeId } from '@/constants/accent-themes';
import type { OrbitColorPalette } from '@/constants/orbit-theme';

export type SeasonId = 'halloween' | 'thanksgiving' | 'christmas';

/** Flip to true in the first update after App Review approves the classic build. */
export const HALLOWEEN_RELEASED = false;
/** Ship with the next update; the window keeps them hidden until their dates. */
export const THANKSGIVING_RELEASED = true;
export const CHRISTMAS_RELEASED = true;

const RELEASED: Record<SeasonId, boolean> = {
  halloween: HALLOWEEN_RELEASED,
  thanksgiving: THANKSGIVING_RELEASED,
  christmas: CHRISTMAS_RELEASED,
};

const KEY_V1 = '@orbit/seasonal_v1';
const KEY = '@orbit/seasonal_v2';

// ── Dates ────────────────────────────────────────────────────────────────────────────────
const day = (y: number, m: number, d: number) => new Date(y, m, d);
const startOfDay = (now: Date) => day(now.getFullYear(), now.getMonth(), now.getDate());

/** US Thanksgiving: the fourth Thursday of November. */
export function usThanksgiving(year: number): Date {
  const first = day(year, 10, 1).getDay(); // 0 Sun … 4 Thu
  const firstThursday = 1 + ((4 - first + 7) % 7);
  return day(year, 10, firstThursday + 21);
}

/** The Monday after Thanksgiving — Thanksgiving ends and Christmas begins. */
function harvestEnds(year: number): Date {
  const t = usThanksgiving(year);
  return day(year, 10, t.getDate() + 4);
}

/** Oct 1 00:00 up to (not including) Nov 1 00:00, local time. */
export function halloweenWindow(now: Date = new Date()): boolean {
  return now.getMonth() === 9;
}

export function thanksgivingWindow(now: Date = new Date()): boolean {
  const y = now.getFullYear();
  return now >= day(y, 10, 1) && now < harvestEnds(y);
}

export function christmasWindow(now: Date = new Date()): boolean {
  const y = now.getFullYear();
  if (now.getMonth() === 0) return now < day(y, 0, 7);
  return now >= harvestEnds(y);
}

const WINDOW: Record<SeasonId, (now: Date) => boolean> = {
  halloween: halloweenWindow,
  thanksgiving: thanksgivingWindow,
  christmas: christmasWindow,
};

export function seasonAvailable(id: SeasonId, now: Date = new Date(), released = RELEASED[id]): boolean {
  return released && WINDOW[id](now);
}

export function halloweenAvailable(now: Date = new Date(), released = HALLOWEEN_RELEASED): boolean {
  return seasonAvailable('halloween', now, released);
}

/** The season in the air today, if any. */
export function currentSeason(now: Date = new Date()): SeasonId | null {
  return (['halloween', 'thanksgiving', 'christmas'] as const).find((id) => seasonAvailable(id, now)) ?? null;
}

/** Days until the season's big day (0 on the day and after). */
export function daysUntil(id: SeasonId, now: Date = new Date()): number {
  const y = now.getFullYear();
  const target =
    id === 'halloween' ? day(y, 9, 31) : id === 'thanksgiving' ? usThanksgiving(y) : day(y, 11, 25);
  return Math.max(0, Math.round((target.getTime() - startOfDay(now).getTime()) / 86_400_000));
}

export function daysUntilHalloween(now: Date = new Date()): number {
  return daysUntil('halloween', now);
}

// ── Look ─────────────────────────────────────────────────────────────────────────────────
type Mascot = { moji: MojiName; name: string };

/** Each color gets its own little character, per season. */
export const SEASON_MASCOT: Record<SeasonId, Record<AccentThemeId, Mascot>> = {
  halloween: {
    sky: { moji: 'ghost', name: 'ghost' },
    citrus: { moji: 'pumpkin', name: 'pumpkin' },
    coral: { moji: 'imp', name: 'little devil' },
    berry: { moji: 'bat', name: 'bat' },
  },
  thanksgiving: {
    sky: { moji: 'feather', name: 'feather' },
    citrus: { moji: 'corn', name: 'corn' },
    coral: { moji: 'turkey', name: 'turkey' },
    berry: { moji: 'mapleLeaf', name: 'maple leaf' },
  },
  christmas: {
    sky: { moji: 'bell', name: 'bell' },
    citrus: { moji: 'star', name: 'star' },
    coral: { moji: 'santaHat', name: 'Santa hat' },
    berry: { moji: 'gift', name: 'present' },
  },
};

export const HALLOWEEN_MONSTER = SEASON_MASCOT.halloween;

/** Each season's accent per color, tuned to glow on its night background. */
const SEASON_ACCENT: Record<SeasonId, Record<AccentThemeId, string>> = {
  halloween: { sky: '#5BA8F0', citrus: '#FF9A2E', coral: '#FF6A3D', berry: '#A58BFF' },
  // Harvest: dusk blue, pumpkin gold, maple, cranberry.
  thanksgiving: { sky: '#7FB2D6', citrus: '#F2A33A', coral: '#E8703F', berry: '#D2557F' },
  // Winter night: frost blue, star gold, holly red, plum.
  christmas: { sky: '#8FD3FF', citrus: '#F5C451', coral: '#F0555A', berry: '#D27BE0' },
};

/** Surfaces each season paints the app with (background, text, cards). */
export const SEASON_SURFACE: Record<
  SeasonId,
  {
    background: string;
    backgroundSoft: string;
    shell: string;
    border: string;
    text: string;
    textSoft: string;
    textMuted: string;
    textSubtle: string;
    textFaint: string;
    tabInactive: string;
    /** The season's card in Home / Activity / Settings. */
    card: string;
    cardEdge: string;
    cardSub: string;
    cardBody: string;
  }
> = {
  halloween: {
    background: '#140C24',
    backgroundSoft: '#1C1236',
    shell: '#0E081A',
    border: 'rgba(181, 150, 255, 0.16)',
    text: '#F5EEFF',
    textSoft: '#DCCFF5',
    textMuted: '#A797C9',
    textSubtle: '#76689A',
    textFaint: '#3F3460',
    tabInactive: '#66598A',
    card: '#3A2470',
    cardEdge: '#7B3FE4',
    cardSub: '#D6CBEF',
    cardBody: '#E4DAF8',
  },
  thanksgiving: {
    background: '#1C120B',
    backgroundSoft: '#271910',
    shell: '#140C07',
    border: 'rgba(242, 163, 58, 0.16)',
    text: '#FFF4E6',
    textSoft: '#F1DCC2',
    textMuted: '#C2A383',
    textSubtle: '#8E7258',
    textFaint: '#4D3A2A',
    tabInactive: '#866A50',
    card: '#5A2E17',
    cardEdge: '#C4682D',
    cardSub: '#F1D3B0',
    cardBody: '#F8E6D0',
  },
  christmas: {
    background: '#0A1C15',
    backgroundSoft: '#10271E',
    shell: '#06130E',
    border: 'rgba(245, 196, 81, 0.15)',
    text: '#F3FFF8',
    textSoft: '#D3EBDF',
    textMuted: '#93B5A5',
    textSubtle: '#628575',
    textFaint: '#2D4A3D',
    tabInactive: '#5C7D6E',
    card: '#14513A',
    cardEdge: '#C9A43D',
    cardSub: '#CDE8DA',
    cardBody: '#E6F5ED',
  },
};

/**
 * A season's night over any palette: its own surfaces and text, the color's accent made
 * seasonal. Everything not listed here (success, warning, Poppins cyan…) is untouched.
 */
export function seasonPalette<P extends OrbitColorPalette & { isDark: boolean }>(
  base: P,
  paletteId: AccentThemeId,
  season: SeasonId
): P {
  const accent = SEASON_ACCENT[season][paletteId] ?? base.primary;
  const s = SEASON_SURFACE[season];
  return {
    ...base,
    background: s.background,
    backgroundSoft: s.backgroundSoft,
    shell: s.shell,
    card: 'rgba(255, 255, 255, 0.06)',
    cardStrong: 'rgba(255, 255, 255, 0.09)',
    cardMuted: 'rgba(255, 255, 255, 0.03)',
    border: s.border,
    borderStrong: `${accent}66`,
    text: s.text,
    textSoft: s.textSoft,
    textMuted: s.textMuted,
    textSubtle: s.textSubtle,
    textFaint: s.textFaint,
    tabInactive: s.tabInactive,
    ink: s.background,
    primary: accent,
    orbitBlue: accent,
    isDark: true,
  };
}

export function halloweenPalette<P extends OrbitColorPalette & { isDark: boolean }>(
  base: P,
  paletteId: AccentThemeId
): P {
  return seasonPalette(base, paletteId, 'halloween');
}

// ── This phone's choice ──────────────────────────────────────────────────────────────────
type Stored = { on: Partial<Record<SeasonId, boolean>>; answered: Partial<Record<SeasonId, boolean>> };
let stored: Stored | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Stored> {
  if (stored) return stored;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      stored = { on: parsed.on ?? {}, answered: parsed.answered ?? {} };
    } else {
      // Carry over the Halloween-only answer from the first build.
      const old = await AsyncStorage.getItem(KEY_V1);
      const v1 = old ? (JSON.parse(old) as { halloween?: boolean; answered?: boolean }) : null;
      stored = { on: { halloween: Boolean(v1?.halloween) }, answered: { halloween: Boolean(v1?.answered) } };
    }
  } catch {
    stored = { on: {}, answered: {} };
  }
  return stored;
}

export async function setSeason(id: SeasonId, on: boolean): Promise<void> {
  const current = stored ?? (await load());
  stored = { on: { ...current.on, [id]: on }, answered: { ...current.answered, [id]: true } };
  listeners.forEach((fn) => fn());
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* best effort */
  }
}

/** Dismiss the season's card without turning it on. */
export async function dismissSeasonCard(id: SeasonId): Promise<void> {
  await setSeason(id, Boolean(stored?.on[id]));
}

export const setHalloween = (on: boolean) => setSeason('halloween', on);
export const dismissHalloweenCard = () => dismissSeasonCard('halloween');

export type SeasonalState = {
  /** The season in the air today (released and inside its window), or null. */
  season: SeasonId | null;
  /** A season exists today. */
  available: boolean;
  /** The season this phone has on right now, or null. */
  active: SeasonId | null;
  halloween: boolean;
  thanksgiving: boolean;
  christmas: boolean;
  /** The member already answered this season's card. */
  answered: boolean;
};

export function useSeasonal(now?: Date): SeasonalState {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    if (!stored) void load().then(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const season = currentSeason(now);
  const active = season && stored?.on[season] ? season : null;
  return {
    season,
    available: season !== null,
    active,
    halloween: active === 'halloween',
    thanksgiving: active === 'thanksgiving',
    christmas: active === 'christmas',
    answered: Boolean(season && stored?.answered[season]),
  };
}

// ── All seasonal themes, for Settings → Your look ────────────────────────────────────────
export type SeasonalTheme = {
  id: SeasonId;
  name: string;
  moji: MojiName;
  blurb: string;
  ends: string;
  available: (now?: Date) => boolean;
};

export const SEASONAL_THEMES: SeasonalTheme[] = [
  {
    id: 'halloween',
    name: 'Halloween',
    moji: 'pumpkin',
    blurb: 'Bats, cobwebs and a little monster for your color',
    ends: 'Ends November 1',
    available: (now) => seasonAvailable('halloween', now),
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    moji: 'turkey',
    blurb: 'Falling leaves, harvest colors and a friend for your color',
    ends: 'Ends the Monday after Thanksgiving',
    available: (now) => seasonAvailable('thanksgiving', now),
  },
  {
    id: 'christmas',
    name: 'Christmas',
    moji: 'xmasTree',
    blurb: 'Snowfall, twinkling lights and a little something for your color',
    ends: 'Ends January 7',
    available: (now) => seasonAvailable('christmas', now),
  },
];

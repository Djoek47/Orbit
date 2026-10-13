/**
 * Seasonal themes laid over the four color palettes. Right now: Halloween.
 *
 * - Ships dark in the classic build: HALLOWEEN_RELEASED is false until the update after
 *   App Review. Flip it to true for that update.
 * - Even when released it only exists from Oct 1 until Nov 1 (local time) and the household
 *   member opts in from the "Halloween is here" card (Activity / Get Started) or Settings.
 * - Off = the normal app, untouched: same palette, same logo, no decorations.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { MojiName } from '@/components/orbit/moji/art';
import type { AccentThemeId } from '@/constants/accent-themes';
import type { OrbitColorPalette } from '@/constants/orbit-theme';

/** Flip to true in the first update after App Review approves the classic build. */
export const HALLOWEEN_RELEASED = false;

const KEY = '@orbit/seasonal_v1';

export type SeasonalState = {
  /** The season exists today (released, and inside its window). */
  available: boolean;
  /** This phone has it on. */
  halloween: boolean;
  /** The member already answered the "Halloween is here" card. */
  answered: boolean;
};

/** Oct 1 00:00 up to (not including) Nov 1 00:00, local time. */
export function halloweenWindow(now: Date = new Date()): boolean {
  return now.getMonth() === 9;
}

export function halloweenAvailable(now: Date = new Date(), released = HALLOWEEN_RELEASED): boolean {
  return released && halloweenWindow(now);
}

/** Days until Oct 31 (0 on the day). */
export function daysUntilHalloween(now: Date = new Date()): number {
  const target = new Date(now.getFullYear(), 9, 31);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

/** Each color gets its own little monster. */
export const HALLOWEEN_MONSTER: Record<AccentThemeId, { moji: MojiName; name: string }> = {
  sky: { moji: 'ghost', name: 'ghost' },
  citrus: { moji: 'pumpkin', name: 'pumpkin' },
  coral: { moji: 'imp', name: 'little devil' },
  berry: { moji: 'bat', name: 'bat' },
};

/** A brighter accent that glows on the night background. */
const HALLOWEEN_ACCENT: Record<AccentThemeId, string> = {
  sky: '#5BA8F0',
  citrus: '#FF9A2E',
  coral: '#FF6A3D',
  berry: '#A58BFF',
};

/**
 * Halloween night over any palette: deep purple surfaces, moonlit text, the color's accent
 * made brighter. Everything not listed here (success, warning, Poppins cyan…) is untouched.
 */
export function halloweenPalette<P extends OrbitColorPalette & { isDark: boolean }>(
  base: P,
  paletteId: AccentThemeId
): P {
  const accent = HALLOWEEN_ACCENT[paletteId] ?? base.primary;
  return {
    ...base,
    background: '#140C24',
    backgroundSoft: '#1C1236',
    shell: '#0E081A',
    card: 'rgba(255, 255, 255, 0.06)',
    cardStrong: 'rgba(255, 255, 255, 0.09)',
    cardMuted: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(181, 150, 255, 0.16)',
    borderStrong: `${accent}66`,
    text: '#F5EEFF',
    textSoft: '#DCCFF5',
    textMuted: '#A797C9',
    textSubtle: '#76689A',
    textFaint: '#3F3460',
    tabInactive: '#66598A',
    ink: '#140C24',
    primary: accent,
    orbitBlue: accent,
    isDark: true,
  };
}

// ── This phone's choice ──────────────────────────────────────────────────────────────────
let stored: { halloween: boolean; answered: boolean } | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<{ halloween: boolean; answered: boolean }> {
  if (stored) return stored;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as { halloween?: boolean; answered?: boolean }) : null;
    stored = { halloween: Boolean(parsed?.halloween), answered: Boolean(parsed?.answered) };
  } catch {
    stored = { halloween: false, answered: false };
  }
  return stored;
}

export async function setHalloween(on: boolean): Promise<void> {
  stored = { halloween: on, answered: true };
  listeners.forEach((fn) => fn());
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* best effort */
  }
}

/** Dismiss the card without turning it on. */
export async function dismissHalloweenCard(): Promise<void> {
  await setHalloween(stored?.halloween ?? false);
}

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
  const available = halloweenAvailable(now);
  return {
    available,
    halloween: available && Boolean(stored?.halloween),
    answered: Boolean(stored?.answered),
  };
}

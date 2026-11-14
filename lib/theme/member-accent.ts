/**
 * Per-person accent for shared devices — visual cue whose account / task list you're in.
 * Jack → Coral (orange) · Emma → Citrus (yellow).
 */
import {
  getAccentTheme,
  migrateAccentThemeId,
  type AccentTheme,
  type AccentThemeId,
} from '@/constants/accent-themes';

/** Designated looks for well-known Sidekick names (shared-tablet demos). */
export const KNOWN_MEMBER_PALETTES: Record<string, AccentThemeId> = {
  jack: 'coral',
  emma: 'citrus',
};

export function knownMemberPaletteId(name: string | null | undefined): AccentThemeId | null {
  if (!name) return null;
  const key = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return KNOWN_MEMBER_PALETTES[key] ?? null;
}

type MemberLike = {
  name?: string | null;
  accentThemeId?: string | null;
};

/**
 * Accent pack for a member. Known Jack/Emma names always map to their designated
 * packs so seed drift (Emma=berry) cannot leave the wrong color on shared devices.
 * Other members use stored accentThemeId, then fallback.
 */
export function resolveMemberAccentTheme(
  member: MemberLike | null | undefined,
  fallbackId?: string | null
): AccentTheme {
  const known = knownMemberPaletteId(member?.name);
  if (known) return getAccentTheme(known);
  if (member?.accentThemeId) return getAccentTheme(migrateAccentThemeId(member.accentThemeId));
  return getAccentTheme(fallbackId);
}

export function resolveMemberAccentColor(
  member: MemberLike | null | undefined,
  fallbackColor?: string
): string {
  if (!member) return fallbackColor ?? getAccentTheme(null).primary;
  return resolveMemberAccentTheme(member).primary;
}

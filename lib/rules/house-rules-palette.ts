/**
 * House Rules colors — HTML At-a-glance renderer tokens.
 * Typography stays Bricolage via AppText.
 */
import type { HouseRulesVoice } from '@/lib/rules/types';

export type { HouseRulesVoice };

/** HTML :root tokens */
export const HR = {
  espresso: '#1B1410',
  card: '#2E241C',
  cream: '#F2E7D4',
  creamDim: '#BCA98F',
  olive: '#8E9C5C',
  ember: '#E4572E',
  navy: '#16233A',
  navyCard: '#1E2E4A',
  navyDeep: '#101A2B',
  amber: '#E9B44C',
  skBg: '#0E1A2E',
  skCard: '#182842',
  skLine: '#22385A',
  skGrape: '#8E7CFF',
  skMango: '#FF9F1C',
  skMint: '#17B9A0',
  skPunch: '#FF5A5F',
  skSlate: '#8595B5',
  skStairs: ['#17B9A0', '#3EC49F', '#8CC63F', '#FF9F1C', '#FF7A2F', '#FF5A5F'] as const,
  silver: '#B9C2CF',
  bronze: '#A9713F',
  skBronze: '#C4834B',
  rampGold: '#B07E22',
  explorer: '#14100D',
  explorerTabBorder: '#3A2E24',
  explorerModeBg: '#221A14',
  missFill: '#9C4433',
  clause: '#EADCC6',
  spineBg: '#372A20',
  chapterBorder: '#3B2E23',
  foot: '#7C6A57',
  pillBg: '#3A2D22',
  pillText: '#D3C0A5',
  glanceInk: '#E7EDF6',
  glanceMuted: '#8DA0BC',
  glanceBody: '#AEBDD2',
  glanceQuietBorder: '#2A3A57',
  fullXp: '#2FA98C',
} as const;

export type HouseRulesPalette = {
  surface: string;
  surfaceSoft: string;
  ink: string;
  inkSoft: string;
  muted: string;
  spine: string;
  spineBg: string;
  accent: string;
  card: string;
  cardBorder: string;
  pillBg: string;
  pillText: string;
  warn: string;
  danger: string;
  success: string;
  groupHead: string;
  quietBorder: string;
  nav: string;
  title: string;
  clause: string;
  foot: string;
  modeOnBg: string;
  deep: string;
};

export function sidekickRoleColor(role?: string): string {
  switch (role) {
    case 'grape':
      return HR.skGrape;
    case 'mango':
      return HR.skMango;
    case 'mint':
      return HR.skMint;
    case 'punch':
      return HR.skPunch;
    case 'ink':
      return HR.skSlate;
    default:
      return HR.skGrape;
  }
}

export function resolveHouseRulesPalette(voice: HouseRulesVoice): HouseRulesPalette {
  if (voice === 'sidekick') {
    return {
      surface: HR.skBg,
      surfaceSoft: HR.skCard,
      ink: '#EAF2FF',
      inkSoft: '#A5B9D6',
      muted: '#8FA4C4',
      spine: HR.skMango,
      spineBg: HR.skMango,
      accent: HR.skMango,
      card: HR.skCard,
      cardBorder: HR.skLine,
      pillBg: HR.skLine,
      pillText: '#CFE0F7',
      warn: HR.skMango,
      danger: HR.skPunch,
      success: HR.skMint,
      groupHead: HR.skMango,
      quietBorder: HR.skLine,
      nav: HR.skMango,
      title: '#EAF2FF',
      clause: '#A5B9D6',
      foot: '#8FA4C4',
      modeOnBg: HR.ember,
      deep: '#101E36',
    };
  }

  return {
    surface: HR.navy,
    surfaceSoft: HR.navyCard,
    ink: HR.glanceInk,
    inkSoft: HR.glanceBody,
    muted: HR.glanceMuted,
    spine: HR.amber,
    spineBg: HR.navyCard,
    accent: HR.amber,
    card: HR.navyCard,
    cardBorder: HR.glanceQuietBorder,
    pillBg: `${HR.amber}28`,
    pillText: HR.amber,
    warn: HR.amber,
    danger: '#9C4433',
    success: HR.fullXp,
    groupHead: HR.amber,
    quietBorder: HR.glanceQuietBorder,
    nav: HR.amber,
    title: HR.glanceInk,
    clause: HR.glanceBody,
    foot: '#6F819C',
    modeOnBg: HR.ember,
    deep: HR.navyDeep,
  };
}

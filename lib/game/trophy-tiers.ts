/**
 * XP trophy ladder — Most Glorious = 100,000 XP.
 * Spec: docs/logic/choremaxx-v2-cursor-spec.md §9
 * Single source of truth — no threshold literals elsewhere.
 */

export type TrophyTier = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  xp: number;
};

export const TROPHY_TIERS: TrophyTier[] = [
  { id: 'first_hundred', label: 'First Hundred', emoji: '🥉', description: 'Earn 100 lifetime XP', xp: 100 },
  { id: 'rising_star', label: 'Rising Star', emoji: '⭐', description: 'Earn 400 lifetime XP', xp: 400 },
  { id: 'thousand_club', label: 'Thousand Club', emoji: '🏅', description: 'Earn 1,000 lifetime XP', xp: 1_000 },
  { id: 'household_hero', label: 'Household Hero', emoji: '🦸', description: 'Earn 2,000 lifetime XP', xp: 2_000 },
  { id: 'decorated', label: 'Decorated', emoji: '🎖️', description: 'Earn 4,000 lifetime XP', xp: 4_000 },
  { id: 'ten_thousand', label: 'Ten Thousand', emoji: '🏆', description: 'Earn 10,000 lifetime XP', xp: 10_000 },
  { id: 'immortal_badge', label: 'Immortal Badge', emoji: '♾️', description: 'Earn 18,000 lifetime XP', xp: 18_000 },
  { id: 'dynasty_trophy', label: 'Dynasty Trophy', emoji: '👑', description: 'Earn 28,000 lifetime XP', xp: 28_000 },
  { id: 'ascendant_cup', label: 'Ascendant Cup', emoji: '🥇', description: 'Earn 40,000 lifetime XP', xp: 40_000 },
  { id: 'sovereign_crown', label: 'Sovereign Crown', emoji: '💠', description: 'Earn 55,000 lifetime XP', xp: 55_000 },
  { id: 'eternal_laurel', label: 'Eternal Laurel', emoji: '🌿', description: 'Earn 75,000 lifetime XP', xp: 75_000 },
  { id: 'most_glorious', label: 'Most Glorious', emoji: '✨', description: 'Earn 100,000 lifetime XP — the ultimate household honor', xp: 100_000 },
];

/** @deprecated Use TROPHY_TIERS */
export const XP_MILESTONE_TROPHIES = TROPHY_TIERS;

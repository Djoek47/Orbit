/**
 * Halo trophy tones — taken only from existing theme / brand tokens.
 * Do not invent new hexes; do not use design-comp blue/violet.
 */
import { choremaxxBrand } from '@/constants/choremaxx-brand';
import { orbitColors } from '@/constants/orbit-theme';

/**
 * Warm → brand rust → gold climb across the 12 XP trophy tiers.
 * Values are existing brand / palette tokens only.
 */
export const TIER_RAMP: readonly string[] = [
  choremaxxBrand.mint, // First Hundred
  choremaxxBrand.sky, // Rising Star
  choremaxxBrand.citrus, // Thousand Club
  choremaxxBrand.coral, // Household Hero
  choremaxxBrand.gold, // Decorated
  orbitColors.rankGold, // Ten Thousand
  choremaxxBrand.coral, // Immortal Badge
  choremaxxBrand.brown, // Dynasty Trophy
  choremaxxBrand.gold, // Ascendant Cup
  choremaxxBrand.coral, // Sovereign Crown
  choremaxxBrand.mint, // Eternal Laurel
  choremaxxBrand.gold, // Most Glorious
] as const;

/** One tone per XP tier, taken from the palette that already exists. */
export function tierTone(tierIndex: number, earned: boolean): string {
  if (!earned) return orbitColors.textMuted;
  return TIER_RAMP[tierIndex] ?? choremaxxBrand.coral;
}

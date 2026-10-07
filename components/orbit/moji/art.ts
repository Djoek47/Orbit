import { GROCERY_ART } from '@/components/orbit/moji/art-grocery';
import { GROCERY_ART_2 } from '@/components/orbit/moji/art-grocery-2';
import { LIFE_ART } from '@/components/orbit/moji/art-life';
import type { MojiArt } from '@/components/orbit/moji/types';

/** Every Moji, by name. */
export const MOJI_ART = {
  ...GROCERY_ART,
  ...GROCERY_ART_2,
  ...LIFE_ART,
} satisfies Record<string, MojiArt>;

export type MojiName = keyof typeof MOJI_ART;

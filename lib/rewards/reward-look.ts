/**
 * How a reward looks — a Moji and a colour per reward, so the catalogue reads as pictures
 * rather than a list of sentences. Presets are mapped by id; anything a family invents is
 * matched on its words, and otherwise gets the gift.
 */
import type { MojiName } from '@/components/orbit/moji/art';

export type RewardLook = { moji: MojiName; color: string };

const BY_PRESET: Record<string, RewardLook> = {
  'preset-screen-time': { moji: 'tv', color: '#4FA3FF' },
  'preset-video-game-time': { moji: 'gamepad', color: '#8E7CFF' },
  'preset-dessert': { moji: 'icecream', color: '#FF7AA2' },
  'preset-choose-dinner': { moji: 'pan', color: '#FF9F1C' },
  'preset-choose-breakfast': { moji: 'cereal', color: '#F5C542' },
  'preset-choose-movie': { moji: 'clapper', color: '#7FC24A' },
  'preset-new-video-game': { moji: 'gamepad', color: '#8E7CFF' },
  'preset-big-outing': { moji: 'rocket', color: '#17B9A0' },
  'preset-room-upgrade': { moji: 'sofa', color: '#C58BFF' },
};

/** Words → a look, for rewards a family writes themselves. First match wins. */
const BY_WORD: { test: RegExp; look: RewardLook }[] = [
  { test: /screen|tv|tablet|ipad|youtube/i, look: { moji: 'tv', color: '#4FA3FF' } },
  { test: /game|xbox|playstation|switch|roblox/i, look: { moji: 'gamepad', color: '#8E7CFF' } },
  { test: /dessert|ice ?cream|candy|sweet|treat/i, look: { moji: 'icecream', color: '#FF7AA2' } },
  { test: /dinner|supper|pizza|meal|restaurant/i, look: { moji: 'pan', color: '#FF9F1C' } },
  { test: /breakfast|pancake|cereal/i, look: { moji: 'cereal', color: '#F5C542' } },
  { test: /movie|cinema|film/i, look: { moji: 'clapper', color: '#7FC24A' } },
  { test: /outing|trip|park|bowling|arcade|zoo|beach/i, look: { moji: 'rocket', color: '#17B9A0' } },
  { test: /room|bed|poster|decor|furniture/i, look: { moji: 'sofa', color: '#C58BFF' } },
  { test: /money|cash|allowance|\$/i, look: { moji: 'moneyBag', color: '#7FC24A' } },
  { test: /book|read/i, look: { moji: 'book', color: '#4FA3FF' } },
  { test: /friend|sleepover|party/i, look: { moji: 'teddy', color: '#FF7AA2' } },
  { test: /late|bedtime|stay up/i, look: { moji: 'moon', color: '#8E7CFF' } },
];

export const DEFAULT_REWARD_LOOK: RewardLook = { moji: 'gift', color: '#FF9F1C' };

export function rewardLook(input: { presetId?: string | null; title?: string | null }): RewardLook {
  if (input.presetId && BY_PRESET[input.presetId]) return BY_PRESET[input.presetId]!;
  const title = input.title?.trim();
  if (title) {
    const hit = BY_WORD.find((rule) => rule.test.test(title));
    if (hit) return hit.look;
  }
  return DEFAULT_REWARD_LOOK;
}

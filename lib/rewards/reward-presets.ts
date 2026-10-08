/**
 * ChoreMaxx v2 reward catalogue presets (§6.2).
 * No emoji. No XP costs — frequency-based grants only.
 */

export type RewardFrequency = 'daily' | 'weekly' | 'monthly';

export type RewardPreset = {
  id: string;
  title: string;
  /** Muted subtitle for Big outing examples, etc. */
  subtitle?: string;
  defaultFrequency: RewardFrequency;
  /** Fixed quantity options where offered (screen time tiers). */
  quantityOptions?: string[];
};

/** Exactly nine presets, daily → weekly → monthly order. */
export const REWARD_PRESETS: RewardPreset[] = [
  {
    id: 'preset-screen-time',
    title: 'Additional screen time',
    defaultFrequency: 'daily',
    quantityOptions: ['30 min', '1 hr', '2 hrs'],
  },
  {
    id: 'preset-video-game-time',
    title: 'Video game time',
    defaultFrequency: 'daily',
    quantityOptions: ['30 min', '1 hr', '2 hrs'],
  },
  {
    id: 'preset-dessert',
    title: 'Dessert choice',
    defaultFrequency: 'daily',
  },
  {
    id: 'preset-choose-dinner',
    title: 'Choose dinner',
    defaultFrequency: 'weekly',
  },
  {
    id: 'preset-choose-breakfast',
    title: 'Choose breakfast',
    defaultFrequency: 'weekly',
  },
  {
    id: 'preset-choose-movie',
    title: 'Choose the movie',
    defaultFrequency: 'weekly',
  },
  {
    id: 'preset-new-video-game',
    title: 'New video game',
    defaultFrequency: 'monthly',
  },
  {
    id: 'preset-big-outing',
    title: 'Big outing',
    subtitle: 'bowling, trampoline park, arcade, cinema',
    defaultFrequency: 'monthly',
  },
  {
    id: 'preset-room-upgrade',
    title: 'Room upgrade item',
    defaultFrequency: 'monthly',
  },
];

export const REWARD_FREQUENCY_LABELS: Record<RewardFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

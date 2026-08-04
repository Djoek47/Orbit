/**
 * Domain / achievement → IconName. Screens never string-match icons.
 */
import type { IconName } from '@/components/orbit/design/icons';
import { TIER_ICONS } from '@/components/orbit/design/icons';

/** All 15 library domains (chores + homework). */
export const DOMAIN_ICON_BY_ID: Record<string, IconName> = {
  kitchen_dining: 'kitchen',
  trash_recycling: 'trash',
  bathroom: 'bathroom',
  laundry: 'laundry',
  bedroom: 'bedroom',
  living_shared: 'livingRoom',
  floors_deep_cleaning: 'floors',
  pets: 'pets',
  car: 'car',
  yard_outdoors: 'yard',
  personal_hygiene: 'hygiene',
  daily_routine: 'dailyRoutine',
  meals_groceries: 'groceries',
  home_maintenance: 'maintenance',
  homework_education: 'homework',
};

/** Habit achievements (8). */
export const ACHIEVEMENT_ICON_BY_ID: Record<string, IconName> = {
  first_task: 'firstStep',
  streak_7: 'weekWarrior',
  homework_ace: 'homeworkAce',
  team_player: 'teamPlayer',
  clean_sweep: 'cleanSweep',
  early_bird: 'earlyBird',
  streak_30: 'monthMaster',
  poppins_fav: 'poppinsFavorite',
};

export function domainIconName(domainId: string): IconName {
  const icon = DOMAIN_ICON_BY_ID[domainId];
  if (!icon) {
    throw new Error(`domainIconName: no IconName for domain "${domainId}"`);
  }
  return icon;
}

export function achievementIconName(achievementId: string): IconName | null {
  return ACHIEVEMENT_ICON_BY_ID[achievementId] ?? null;
}

export function trophyIconName(tierIndex: number): IconName {
  const icon = TIER_ICONS[tierIndex];
  if (!icon) {
    throw new Error(`trophyIconName: no IconName for tier index ${tierIndex}`);
  }
  return icon;
}

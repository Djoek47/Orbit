import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HouseholdRole, HouseholdType } from '@/types/orbit';

export type OnboardingRole = 'parent' | 'caregiver' | 'child' | 'roommate';

export type MotivationMode =
  | 'none'
  | 'allowance'
  | 'xp'
  | 'xp_rewards'
  | 'allowance_xp'
  | 'allowance_rewards'
  | 'custom';

export type OnboardingPrefs = {
  role: OnboardingRole;
  motivation: MotivationMode;
  completedAt: string;
};

export const ONBOARDING_ROLES: {
  id: OnboardingRole;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  perks: string[];
}[] = [
  {
    id: 'parent',
    emoji: '👑',
    title: 'Parent',
    subtitle: 'Full household admin',
    color: '#3BB5F0',
    perks: ['Assign & approve tasks', 'Manage allowance & rewards', 'See all analytics', 'Invite members'],
  },
  {
    id: 'caregiver',
    emoji: '🤝',
    title: 'Caregiver',
    subtitle: 'Assign & approve tasks',
    color: '#2DD4BF',
    perks: ['Assign tasks to anyone', 'Complete & approve chores', 'View household progress'],
  },
  {
    id: 'child',
    emoji: '⭐',
    title: 'Child',
    subtitle: 'Earn XP & rewards',
    color: '#34D399',
    perks: ['See my tasks clearly', 'Earn XP & level up', 'Unlock rewards', 'Build good habits'],
  },
  {
    id: 'roommate',
    emoji: '🏠',
    title: 'Roommate',
    subtitle: 'Shared living, simplified',
    color: '#A78BFA',
    perks: ['Shared chores & bills', 'Rotation schedules', 'Shared groceries', 'No parenting language'],
  },
];

export const ONBOARDING_MOTIVATIONS: {
  id: MotivationMode;
  emoji: string;
  label: string;
  desc: string;
  wide?: boolean;
}[] = [
  { id: 'none', emoji: '🧘', label: 'No rewards', desc: 'Just get things done' },
  { id: 'xp', emoji: '⚡', label: 'XP only', desc: 'Level up with points' },
  { id: 'xp_rewards', emoji: '🎁', label: 'XP + Rewards', desc: 'Points unlock fun prizes' },
  { id: 'allowance', emoji: '💰', label: 'Allowance', desc: 'Earn real money for chores' },
  { id: 'allowance_xp', emoji: '🌟', label: 'Allowance + XP', desc: 'Money & levels combined' },
  { id: 'allowance_rewards', emoji: '🏆', label: 'Full System', desc: 'Allowance, XP & rewards', wide: true },
  { id: 'custom', emoji: '✏️', label: 'Custom', desc: 'Build your own system', wide: true },
];

const KEY = 'choremaxx.onboarding.v7';

export async function loadOnboardingPrefs(): Promise<OnboardingPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingPrefs;
  } catch {
    return null;
  }
}

export async function saveOnboardingPrefs(
  prefs: Omit<OnboardingPrefs, 'completedAt'>,
): Promise<OnboardingPrefs> {
  const next: OnboardingPrefs = {
    ...prefs,
    completedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearOnboardingPrefs() {
  await AsyncStorage.removeItem(KEY);
}

/** Map Make onboarding role → household membership role. */
export function onboardingRoleToHouseholdRole(role: OnboardingRole): HouseholdRole {
  switch (role) {
    case 'parent':
      return 'owner';
    case 'caregiver':
      return 'admin';
    case 'child':
      return 'child';
    case 'roommate':
      return 'adult';
    default:
      return 'adult';
  }
}

export function onboardingRoleToHouseholdType(role: OnboardingRole): HouseholdType {
  switch (role) {
    case 'roommate':
      return 'roommates';
    case 'parent':
    case 'caregiver':
    case 'child':
      return 'family';
    default:
      return 'family';
  }
}

export function skipsMotivation(role: OnboardingRole) {
  return role === 'child' || role === 'roommate';
}

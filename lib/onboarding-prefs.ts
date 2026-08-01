import AsyncStorage from '@react-native-async-storage/async-storage';

import type { HouseholdRole, HouseholdType } from '@/types/orbit';

export type OnboardingRole = 'parent' | 'child' | 'roommate' | 'shared-tablet';

/** Legacy role kept only so old AsyncStorage prefs can be migrated. */
type LegacyOnboardingRole = OnboardingRole | 'caregiver';

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
    perks: ['Assign & approve', 'Allowance & rewards', 'Invite members', 'Analytics'],
  },
  {
    id: 'child',
    emoji: '⭐',
    title: 'Child',
    subtitle: 'Join with a parent invite',
    color: '#34D399',
    perks: ['My tasks', 'Earn XP', 'Unlock rewards', 'Build habits'],
  },
  {
    id: 'roommate',
    emoji: '🏠',
    title: 'Roommate',
    subtitle: 'Shared living, simplified',
    color: '#A78BFA',
    perks: ['Shared chores', 'Groceries', 'Rotations', 'No parenting tone'],
  },
  {
    id: 'shared-tablet',
    emoji: '📱',
    title: 'Shared / tablet',
    subtitle: 'One device · several profiles',
    color: '#F59E0B',
    perks: ['Multiple profiles', 'Quick switch', 'Kid-safe', 'No tablet email'],
  },
];

export const ONBOARDING_MOTIVATIONS: {
  id: MotivationMode;
  emoji: string;
  label: string;
  desc: string;
  wide?: boolean;
}[] = [
  { id: 'none', emoji: '🧘', label: 'No rewards', desc: 'Quiet focus, no points' },
  { id: 'xp', emoji: '⚡', label: 'XP only', desc: 'Levels that celebrate effort' },
  { id: 'xp_rewards', emoji: '🎁', label: 'XP + Rewards', desc: 'Points unlock fun prizes' },
  { id: 'allowance', emoji: '💰', label: 'Allowance', desc: 'Real money for real help' },
  { id: 'allowance_xp', emoji: '🌟', label: 'Allowance + XP', desc: 'Money and levels together' },
  { id: 'allowance_rewards', emoji: '🏆', label: 'Full System', desc: 'Allowance, XP & rewards', wide: true },
  { id: 'custom', emoji: '✏️', label: 'Custom', desc: 'Tune it later in Settings', wide: true },
];

/** Splash micro-hooks (Design 8 glass onboarding). */
export const ONBOARDING_SPLASH_HOOKS = [
  { text: 'Zero clutter. Quiet rhythm.', color: '#3BB5F0' },
  { text: 'Nova co-manages the home.', color: '#2DD4BF' },
  { text: 'Built for real households.', color: '#F59E0B' },
] as const;

const KEY = 'choremaxx.onboarding.v7';

function normalizeOnboardingRole(role: LegacyOnboardingRole | string | undefined): OnboardingRole {
  if (role === 'child' || role === 'roommate' || role === 'parent' || role === 'shared-tablet') {
    return role;
  }
  // Former "Caregiver" choice → Parent. Never surface as a greeting name.
  return 'parent';
}

export async function loadOnboardingPrefs(): Promise<OnboardingPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      role?: string;
      motivation?: MotivationMode;
      completedAt?: string;
    };
    const role = normalizeOnboardingRole(parsed.role);
    const motivation = parsed.motivation ?? 'xp';
    const prefs: OnboardingPrefs = {
      role,
      motivation,
      completedAt: parsed.completedAt ?? new Date().toISOString(),
    };
    if (parsed.role === 'caregiver') {
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
    }
    return prefs;
  } catch {
    return null;
  }
}

export async function saveOnboardingPrefs(
  prefs: Omit<OnboardingPrefs, 'completedAt'>,
): Promise<OnboardingPrefs> {
  const next: OnboardingPrefs = {
    role: normalizeOnboardingRole(prefs.role),
    motivation: prefs.motivation,
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
    case 'child':
      return 'child';
    case 'roommate':
      return 'adult';
    case 'shared-tablet':
      return 'shared-device';
    default:
      return 'adult';
  }
}

export function onboardingRoleToHouseholdType(role: OnboardingRole): HouseholdType {
  switch (role) {
    case 'roommate':
    case 'shared-tablet':
      return 'roommates';
    case 'parent':
    case 'child':
      return 'family';
    default:
      return 'family';
  }
}

export function skipsMotivation(role: OnboardingRole) {
  return role === 'child' || role === 'roommate' || role === 'shared-tablet';
}

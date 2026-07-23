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
    perks: ['Assign & approve tasks', 'Manage allowance & rewards', 'See all analytics', 'Invite members'],
  },
  {
    id: 'child',
    emoji: '⭐',
    title: 'Child',
    subtitle: 'Join with a parent invite — no sign-in',
    color: '#34D399',
    perks: ['Open an AirDrop or invite code', 'No email or password', 'See my tasks & earn XP', 'Parent keeps the household saved'],
  },
  {
    id: 'roommate',
    emoji: '🏠',
    title: 'Roommate',
    subtitle: 'Shared living, simplified',
    color: '#A78BFA',
    perks: ['Shared chores', 'Shared grocery list', 'Simple schedules', 'Stay in sync'],
  },
  {
    id: 'shared-tablet',
    emoji: '📱',
    title: 'Shared / tablet',
    subtitle: 'One device, several profiles — invite or AirDrop',
    color: '#F59E0B',
    perks: [
      'Host kids or roommates on one tablet',
      'Add profiles via invite code or AirDrop QR',
      'No email on the tablet itself',
      'Admin account keeps household data saved',
    ],
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

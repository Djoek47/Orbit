import AsyncStorage from '@react-native-async-storage/async-storage';

import { INTRO_SLOGANS } from '@/constants/vocabulary';
import {
  DEFAULT_REWARD_MODEL,
  migrateLegacyRewardModel,
  type RewardModel,
} from '@/lib/rewards/reward-model';
import type { RewardMode } from '@/lib/rewards/reward-mode';
import type { HouseholdRole } from '@/types/orbit';

export type OnboardingRole = 'parent' | 'child' | 'shared-tablet';

/** Legacy roles kept only so old AsyncStorage prefs can be migrated. */
type LegacyOnboardingRole = OnboardingRole | 'caregiver' | 'roommate';

/** @deprecated Prefer RewardModel — kept for AsyncStorage migration. */
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
  /** ChoreMaxx v2 §2 reward model. */
  rewardModel: RewardModel;
  /** Meritocracy (`weighted`) vs Equity (`flat`). Defaults to weighted when missing. */
  rewardMode?: RewardMode;
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
    id: 'shared-tablet',
    emoji: '📱',
    title: 'Shared / tablet',
    subtitle: 'One device · several profiles',
    color: '#F59E0B',
    perks: ['Multiple profiles', 'Quick switch', 'Kid-safe', 'No tablet email'],
  },
];

/** @deprecated Use REWARD_MODEL_OPTIONS from reward-model.ts */
export const ONBOARDING_MOTIVATIONS: {
  id: MotivationMode;
  emoji: string;
  label: string;
  desc: string;
  wide?: boolean;
}[] = [
  { id: 'xp', emoji: '⚡', label: 'XP only', desc: 'Levels that celebrate effort' },
  { id: 'allowance', emoji: '💰', label: 'Allowance', desc: 'Real money for real help' },
  { id: 'xp_rewards', emoji: '🎁', label: 'XP + Rewards', desc: 'Points unlock fun prizes' },
  { id: 'allowance_xp', emoji: '🌟', label: 'Allowance + XP', desc: 'Money and levels together' },
  { id: 'allowance_rewards', emoji: '🏆', label: 'Full System', desc: 'Allowance, XP & rewards', wide: true },
];

/** Splash micro-hooks — Revision E §1.2 slogans (colors are chrome only). */
export const ONBOARDING_SPLASH_HOOKS = [
  { text: INTRO_SLOGANS[0], color: '#3BB5F0' },
  { text: INTRO_SLOGANS[1], color: '#2DD4BF' },
  { text: INTRO_SLOGANS[2], color: '#F59E0B' },
] as const;

const KEY = 'choremaxx.onboarding.v7';

function normalizeOnboardingRole(role: LegacyOnboardingRole | string | undefined): OnboardingRole {
  if (role === 'child' || role === 'parent' || role === 'shared-tablet') {
    return role;
  }
  // Former "Caregiver" / "Roommate" choices → Parent.
  return 'parent';
}

function normalizeRewardMode(value: string | undefined): RewardMode {
  return value === 'flat' ? 'flat' : 'weighted';
}

function motivationToRewardModel(motivation: MotivationMode | string | undefined): RewardModel {
  switch (motivation) {
    case 'none':
      return 'xp_only';
    case 'xp':
      return 'xp_only';
    case 'allowance':
      return 'allowance';
    case 'xp_rewards':
      return 'xp_rewards';
    case 'allowance_xp':
      return 'xp_allowance';
    case 'allowance_rewards':
      return 'full';
    case 'custom':
      return migrateLegacyRewardModel({ legacy: 'custom' });
    default:
      return DEFAULT_REWARD_MODEL;
  }
}

export async function loadOnboardingPrefs(): Promise<OnboardingPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      role?: string;
      motivation?: MotivationMode;
      rewardModel?: RewardModel | string;
      rewardMode?: RewardMode | string;
      completedAt?: string;
    };
    const role = normalizeOnboardingRole(parsed.role);
    const rewardModel =
      (parsed.rewardModel as RewardModel | undefined) ??
      motivationToRewardModel(parsed.motivation) ??
      DEFAULT_REWARD_MODEL;
    const rewardMode = normalizeRewardMode(parsed.rewardMode);
    const prefs: OnboardingPrefs = {
      role,
      rewardModel: migrateLegacyRewardModel({ legacy: rewardModel }),
      rewardMode,
      completedAt: parsed.completedAt ?? new Date().toISOString(),
    };
    if (
      parsed.role === 'caregiver' ||
      parsed.role === 'roommate' ||
      parsed.rewardMode == null ||
      parsed.rewardModel == null
    ) {
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
    }
    return prefs;
  } catch {
    return null;
  }
}

export async function saveOnboardingPrefs(
  prefs: Omit<OnboardingPrefs, 'completedAt'> & { motivation?: MotivationMode }
): Promise<OnboardingPrefs> {
  const rewardModel =
    prefs.rewardModel ??
    (prefs.motivation ? motivationToRewardModel(prefs.motivation) : DEFAULT_REWARD_MODEL);
  const next: OnboardingPrefs = {
    role: normalizeOnboardingRole(prefs.role),
    rewardModel: migrateLegacyRewardModel({ legacy: rewardModel }),
    rewardMode: normalizeRewardMode(prefs.rewardMode),
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
    case 'shared-tablet':
      return 'shared-device';
    default:
      return 'adult';
  }
}

export function skipsMotivation(role: OnboardingRole) {
  return role === 'child' || role === 'shared-tablet';
}

export { motivationToRewardModel };

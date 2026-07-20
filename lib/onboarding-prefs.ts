import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function saveOnboardingPrefs(prefs: Omit<OnboardingPrefs, 'completedAt'>): Promise<OnboardingPrefs> {
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

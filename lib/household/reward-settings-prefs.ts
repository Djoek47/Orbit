import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_MEMBER_CAPABILITIES,
  type MemberCapabilities,
} from '@/lib/member-capabilities';
import type { HouseholdSnapshot } from '@/types/orbit';

const SETTINGS_KEY = '@orbit/household_reward_settings';
const CAPS_KEY = '@orbit/member_capabilities';

export type PersistedRewardSettings = {
  rewardMode: 'weighted' | 'flat';
  hygieneRewarded: boolean;
  hygieneXp: 5 | 10;
};

export async function loadRewardSettings(
  householdId: string | null | undefined
): Promise<Partial<PersistedRewardSettings> | null> {
  if (!householdId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${SETTINGS_KEY}:${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedRewardSettings>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveRewardSettings(
  householdId: string | null | undefined,
  settings: PersistedRewardSettings
) {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${SETTINGS_KEY}:${householdId}`, JSON.stringify(settings));
  } catch (error) {
    console.warn('saveRewardSettings failed', error);
  }
}

export async function loadMemberCapabilitiesPrefs(
  householdId: string | null | undefined
): Promise<Partial<MemberCapabilities> | null> {
  if (!householdId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${CAPS_KEY}:${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemberCapabilities>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveMemberCapabilitiesPrefs(
  householdId: string | null | undefined,
  caps: MemberCapabilities
) {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${CAPS_KEY}:${householdId}`, JSON.stringify(caps));
  } catch (error) {
    console.warn('saveMemberCapabilitiesPrefs failed', error);
  }
}

/** Merge stored prefs onto a household snapshot (AsyncStorage wins when present). */
export async function applyStoredHouseholdLogicPrefs(
  household: HouseholdSnapshot
): Promise<HouseholdSnapshot> {
  if (!household.id) return household;
  const [settings, caps] = await Promise.all([
    loadRewardSettings(household.id),
    loadMemberCapabilitiesPrefs(household.id),
  ]);
  return {
    ...household,
    rewardMode: settings?.rewardMode ?? household.rewardMode ?? 'weighted',
    hygieneRewarded: settings?.hygieneRewarded ?? household.hygieneRewarded ?? false,
    hygieneXp: settings?.hygieneXp === 10 ? 10 : settings?.hygieneXp === 5 ? 5 : household.hygieneXp ?? 5,
    memberCapabilities: {
      ...DEFAULT_MEMBER_CAPABILITIES,
      ...(household.memberCapabilities ?? {}),
      ...(caps ?? {}),
    },
  };
}

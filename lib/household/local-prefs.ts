import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_QUICK_PRESET_IDS } from '@/data/choremaxx-task-library';
import type { HouseholdRoom } from '@/types/orbit';

const ROOMS_KEY = '@orbit/household_rooms';
const AVATARS_KEY = '@orbit/member_avatars';
const QUICK_PRESETS_KEY = '@orbit/quick_preset_ids';

export async function loadHouseholdRooms(
  householdId: string | null | undefined,
): Promise<HouseholdRoom[] | null> {
  if (!householdId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${ROOMS_KEY}:${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HouseholdRoom[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveHouseholdRooms(
  householdId: string | null | undefined,
  rooms: HouseholdRoom[],
) {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${ROOMS_KEY}:${householdId}`, JSON.stringify(rooms));
  } catch (error) {
    console.warn('saveHouseholdRooms failed', error);
  }
}

export async function loadMemberAvatarOverrides(
  householdId: string | null | undefined,
): Promise<Record<string, string>> {
  if (!householdId) return {};
  try {
    const raw = await AsyncStorage.getItem(`${AVATARS_KEY}:${householdId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveMemberAvatarOverride(
  householdId: string | null | undefined,
  memberId: string,
  avatar: string,
) {
  if (!householdId) return;
  try {
    const current = await loadMemberAvatarOverrides(householdId);
    current[memberId] = avatar;
    await AsyncStorage.setItem(`${AVATARS_KEY}:${householdId}`, JSON.stringify(current));
  } catch (error) {
    console.warn('saveMemberAvatarOverride failed', error);
  }
}

export async function loadQuickPresetIds(
  householdId: string | null | undefined,
): Promise<string[]> {
  if (!householdId) return [...DEFAULT_QUICK_PRESET_IDS];
  try {
    const raw = await AsyncStorage.getItem(`${QUICK_PRESETS_KEY}:${householdId}`);
    if (!raw) return [...DEFAULT_QUICK_PRESET_IDS];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_QUICK_PRESET_IDS];
  } catch {
    return [...DEFAULT_QUICK_PRESET_IDS];
  }
}

export async function saveQuickPresetIds(
  householdId: string | null | undefined,
  ids: string[],
) {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${QUICK_PRESETS_KEY}:${householdId}`, JSON.stringify(ids));
  } catch (error) {
    console.warn('saveQuickPresetIds failed', error);
  }
}

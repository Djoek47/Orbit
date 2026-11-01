import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_MAJORDOMO_PROFILE_ID,
  isMajordomoProfileId,
  type MajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';

const HOUSEHOLD_KEY = '@orbit/majordomo_profile';
const MEMBER_KEY = '@orbit/member_majordomo_profile';

export async function loadMajordomoProfileId(
  householdId: string | null | undefined
): Promise<MajordomoProfileId> {
  if (!householdId) return DEFAULT_MAJORDOMO_PROFILE_ID;
  try {
    const raw = await AsyncStorage.getItem(`${HOUSEHOLD_KEY}:${householdId}`);
    if (isMajordomoProfileId(raw)) return raw;
    return DEFAULT_MAJORDOMO_PROFILE_ID;
  } catch {
    return DEFAULT_MAJORDOMO_PROFILE_ID;
  }
}

export async function saveMajordomoProfileId(
  householdId: string | null | undefined,
  profileId: MajordomoProfileId
) {
  if (!householdId) return;
  try {
    await AsyncStorage.setItem(`${HOUSEHOLD_KEY}:${householdId}`, profileId);
  } catch (error) {
    console.warn('saveMajordomoProfileId failed', error);
  }
}

export async function loadMemberMajordomoProfileId(
  householdId: string | null | undefined,
  memberId: string | null | undefined
): Promise<MajordomoProfileId | null> {
  if (!householdId || !memberId) return null;
  try {
    const raw = await AsyncStorage.getItem(`${MEMBER_KEY}:${householdId}:${memberId}`);
    if (isMajordomoProfileId(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

export async function saveMemberMajordomoProfileId(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
  profileId: MajordomoProfileId | null
) {
  if (!householdId || !memberId) return;
  try {
    const key = `${MEMBER_KEY}:${householdId}:${memberId}`;
    if (!profileId) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, profileId);
  } catch (error) {
    console.warn('saveMemberMajordomoProfileId failed', error);
  }
}

export async function applyStoredMajordomoProfiles<
  T extends { id: string; majordomoProfileId?: string },
>(
  householdId: string | null | undefined,
  members: T[],
  householdProfileId?: string | null
): Promise<{ members: T[]; householdProfileId: MajordomoProfileId }> {
  const householdStored = await loadMajordomoProfileId(householdId);
  const resolvedHousehold = isMajordomoProfileId(householdProfileId)
    ? householdProfileId
    : householdStored;

  if (!householdId) {
    return { members, householdProfileId: resolvedHousehold };
  }

  const nextMembers = await Promise.all(
    members.map(async (member) => {
      const stored = await loadMemberMajordomoProfileId(householdId, member.id);
      if (!stored) {
        return {
          ...member,
          majordomoProfileId: isMajordomoProfileId(member.majordomoProfileId)
            ? member.majordomoProfileId
            : undefined,
        };
      }
      return { ...member, majordomoProfileId: stored };
    })
  );

  return { members: nextMembers, householdProfileId: resolvedHousehold };
}

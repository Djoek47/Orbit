import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_ACCENT_THEME_ID,
  isResolvableAccentThemeId,
  migrateAccentThemeId,
  type AccentThemeId,
} from '@/constants/accent-themes';

const HOUSEHOLD_KEY = '@orbit/accent_theme';
const MEMBER_KEY = '@orbit/member_accent_theme';

export async function loadAccentThemeId(
  householdId: string | null | undefined
): Promise<AccentThemeId> {
  if (!householdId) {
    return DEFAULT_ACCENT_THEME_ID;
  }
  try {
    const raw = await AsyncStorage.getItem(`${HOUSEHOLD_KEY}:${householdId}`);
    if (isResolvableAccentThemeId(raw)) {
      const migrated = migrateAccentThemeId(raw);
      if (migrated !== raw) {
        await AsyncStorage.setItem(`${HOUSEHOLD_KEY}:${householdId}`, migrated);
      }
      return migrated;
    }
    return DEFAULT_ACCENT_THEME_ID;
  } catch {
    return DEFAULT_ACCENT_THEME_ID;
  }
}

export async function saveAccentThemeId(
  householdId: string | null | undefined,
  themeId: AccentThemeId
) {
  if (!householdId) {
    return;
  }
  try {
    await AsyncStorage.setItem(`${HOUSEHOLD_KEY}:${householdId}`, themeId);
  } catch (error) {
    console.warn('saveAccentThemeId failed', error);
  }
}

export async function loadMemberAccentThemeId(
  householdId: string | null | undefined,
  memberId: string | null | undefined
): Promise<AccentThemeId | null> {
  if (!householdId || !memberId) {
    return null;
  }
  try {
    const raw = await AsyncStorage.getItem(`${MEMBER_KEY}:${householdId}:${memberId}`);
    if (!isResolvableAccentThemeId(raw)) return null;
    const migrated = migrateAccentThemeId(raw);
    if (migrated !== raw) {
      await AsyncStorage.setItem(`${MEMBER_KEY}:${householdId}:${memberId}`, migrated);
    }
    return migrated;
  } catch {
    return null;
  }
}

export async function saveMemberAccentThemeId(
  householdId: string | null | undefined,
  memberId: string | null | undefined,
  themeId: AccentThemeId
) {
  if (!householdId || !memberId) {
    return;
  }
  try {
    await AsyncStorage.setItem(`${MEMBER_KEY}:${householdId}:${memberId}`, themeId);
  } catch (error) {
    console.warn('saveMemberAccentThemeId failed', error);
  }
}

/** Hydrate all known members' stored personal themes into the snapshot. */
export async function applyStoredMemberThemes<T extends { id: string; accentThemeId?: string }>(
  householdId: string | null | undefined,
  members: T[]
): Promise<T[]> {
  if (!householdId) {
    return members;
  }
  return Promise.all(
    members.map(async (member) => {
      const stored = await loadMemberAccentThemeId(householdId, member.id);
      if (!stored) {
        return {
          ...member,
          accentThemeId: migrateAccentThemeId(member.accentThemeId),
        };
      }
      return { ...member, accentThemeId: stored };
    })
  );
}

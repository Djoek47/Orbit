import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession, OrbitUser } from '@/types/orbit';

const SESSION_KEY = 'choremaxx.mockSession.v1';
const MEMBER_KEY = 'choremaxx.activeMemberId.v1';

type StoredMockSession = {
  user: OrbitUser;
  activeMemberId?: string | null;
  savedAt: string;
};

export async function loadMockSession(): Promise<StoredMockSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMockSession;
    if (!parsed?.user?.id || !parsed.user.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveMockSession(
  user: OrbitUser,
  activeMemberId?: string | null,
): Promise<void> {
  const payload: StoredMockSession = {
    user,
    activeMemberId: activeMemberId ?? null,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  if (activeMemberId) {
    await AsyncStorage.setItem(MEMBER_KEY, activeMemberId);
  }
}

export async function clearMockSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, MEMBER_KEY]);
}

export async function loadActiveMemberId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(MEMBER_KEY)) || null;
  } catch {
    return null;
  }
}

export async function saveActiveMemberId(memberId: string | null): Promise<void> {
  if (!memberId) {
    await AsyncStorage.removeItem(MEMBER_KEY);
    return;
  }
  await AsyncStorage.setItem(MEMBER_KEY, memberId);
}

export function toAuthSession(user: OrbitUser): AuthSession {
  return { user };
}

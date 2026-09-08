/**
 * Sidekick device session — survives sign-out so the same profile can rejoin
 * without scanning the QR again (TestFlight / Supabase has no auth JWT for kids).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@orbit/sidekick_session.v1';

export type SidekickSession = {
  memberId: string;
  householdId: string;
  profileInviteCode: string;
  displayName: string;
  avatar?: string;
  householdName?: string;
  savedAt: string;
  /** Updated whenever the device successfully syncs or signs out. */
  lastConnectedAt?: string;
};

export async function loadSidekickSession(): Promise<SidekickSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SidekickSession;
    if (!parsed?.memberId || !parsed?.householdId || !parsed?.profileInviteCode?.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSidekickSession(session: Omit<SidekickSession, 'savedAt'>): Promise<void> {
  const existing = await loadSidekickSession();
  const payload: SidekickSession = {
    ...session,
    profileInviteCode: session.profileInviteCode.trim().toUpperCase(),
    savedAt: new Date().toISOString(),
    lastConnectedAt: session.lastConnectedAt ?? existing?.lastConnectedAt,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

/** Bump last-connected timestamp after a successful sync or before sign-out. */
export async function touchSidekickSession(): Promise<void> {
  const session = await loadSidekickSession();
  if (!session) return;
  await saveSidekickSession({
    ...session,
    lastConnectedAt: new Date().toISOString(),
  });
}

export async function clearSidekickSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

const SIGNED_OUT_KEY = '@orbit/sidekick_signed_out.v1';

export async function markSidekickSignedOut(): Promise<void> {
  await AsyncStorage.setItem(SIGNED_OUT_KEY, '1');
}

export async function clearSidekickSignedOut(): Promise<void> {
  await AsyncStorage.removeItem(SIGNED_OUT_KEY);
}

export async function wasSidekickSignedOut(): Promise<boolean> {
  return (await AsyncStorage.getItem(SIGNED_OUT_KEY)) === '1';
}

export function isSidekickLocalUserId(userId: string | null | undefined): boolean {
  return Boolean(userId?.startsWith('child-local-') || userId?.startsWith('tablet-local-'));
}

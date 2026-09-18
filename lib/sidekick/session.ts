/**
 * Sidekick device session — survives sign-out so the same profile can rejoin
 * without scanning the QR again (TestFlight / Supabase has no auth JWT for kids).
 *
 * v2 keys sessions by member so a shared tablet can host several children.
 * DeviceSession.activeMemberId remains the single source of truth for "who is active".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDeviceSession } from '@/lib/device/device-session';

export const SIDEKICK_SESSION_KEY_V1 = '@orbit/sidekick_session.v1';
export const SIDEKICK_SESSION_KEY_V2 = '@orbit/sidekick_sessions.v2';

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

export type SidekickSessionStore = {
  byMemberId: Record<string, SidekickSession>;
};

export function isValidSidekickSession(parsed: unknown): parsed is SidekickSession {
  if (!parsed || typeof parsed !== 'object') return false;
  const s = parsed as SidekickSession;
  return Boolean(s.memberId && s.householdId && s.profileInviteCode?.trim());
}

export function normalizeSidekickSession(session: SidekickSession): SidekickSession {
  return {
    ...session,
    profileInviteCode: session.profileInviteCode.trim().toUpperCase(),
  };
}

/** Pure: merge v1 into v2. Caller writes v2 then deletes v1 when `didMigrate`. */
export function resolveSidekickStore(input: {
  v2Raw: string | null;
  v1Raw: string | null;
}): { store: SidekickSessionStore; didMigrate: boolean } {
  if (input.v2Raw) {
    try {
      const parsed = JSON.parse(input.v2Raw) as SidekickSessionStore;
      if (parsed?.byMemberId && typeof parsed.byMemberId === 'object') {
        return { store: { byMemberId: { ...parsed.byMemberId } }, didMigrate: false };
      }
    } catch {
      /* fall through */
    }
  }

  if (!input.v1Raw) return { store: { byMemberId: {} }, didMigrate: false };

  try {
    const v1 = JSON.parse(input.v1Raw) as SidekickSession;
    if (!isValidSidekickSession(v1)) {
      return { store: { byMemberId: {} }, didMigrate: true };
    }
    return {
      store: { byMemberId: { [v1.memberId]: normalizeSidekickSession(v1) } },
      didMigrate: true,
    };
  } catch {
    return { store: { byMemberId: {} }, didMigrate: true };
  }
}

async function readStore(): Promise<SidekickSessionStore> {
  try {
    const [v2Raw, v1Raw] = await Promise.all([
      AsyncStorage.getItem(SIDEKICK_SESSION_KEY_V2),
      AsyncStorage.getItem(SIDEKICK_SESSION_KEY_V1),
    ]);
    const { store, didMigrate } = resolveSidekickStore({ v2Raw, v1Raw });
    if (didMigrate) {
      // Write v2 before deleting v1 — never log out an already-redeemed child.
      await AsyncStorage.setItem(SIDEKICK_SESSION_KEY_V2, JSON.stringify(store));
      await AsyncStorage.removeItem(SIDEKICK_SESSION_KEY_V1);
    }
    return store;
  } catch {
    return { byMemberId: {} };
  }
}

async function writeStore(store: SidekickSessionStore): Promise<void> {
  await AsyncStorage.setItem(SIDEKICK_SESSION_KEY_V2, JSON.stringify(store));
}

export async function loadSidekickSessionStore(): Promise<SidekickSessionStore> {
  return readStore();
}

export async function listSidekickSessions(): Promise<SidekickSession[]> {
  const store = await readStore();
  return Object.values(store.byMemberId);
}

export async function loadSidekickSessionFor(memberId: string): Promise<SidekickSession | null> {
  if (!memberId) return null;
  const store = await readStore();
  const session = store.byMemberId[memberId];
  return session && isValidSidekickSession(session) ? normalizeSidekickSession(session) : null;
}

/** Active profile: DeviceSession.activeMemberId → v2 entry (falls back to sole entry). */
export async function loadSidekickSession(): Promise<SidekickSession | null> {
  const store = await readStore();
  const entries = Object.values(store.byMemberId).filter(isValidSidekickSession);
  if (entries.length === 0) return null;

  const device = await loadDeviceSession();
  if (device.activeMemberId) {
    const active = store.byMemberId[device.activeMemberId];
    if (active && isValidSidekickSession(active)) return normalizeSidekickSession(active);
  }

  if (entries.length === 1) return normalizeSidekickSession(entries[0]!);
  return null;
}

export async function saveSidekickSessionFor(
  memberId: string,
  session: Omit<SidekickSession, 'savedAt'>
): Promise<void> {
  const store = await readStore();
  const existing = store.byMemberId[memberId];
  const payload: SidekickSession = normalizeSidekickSession({
    ...session,
    memberId,
    savedAt: new Date().toISOString(),
    lastConnectedAt: session.lastConnectedAt ?? existing?.lastConnectedAt,
  });
  store.byMemberId[memberId] = payload;
  await writeStore(store);
}

export async function saveSidekickSession(session: Omit<SidekickSession, 'savedAt'>): Promise<void> {
  await saveSidekickSessionFor(session.memberId, session);
}

export async function removeSidekickSessionFor(memberId: string): Promise<void> {
  const store = await readStore();
  if (!store.byMemberId[memberId]) return;
  delete store.byMemberId[memberId];
  if (Object.keys(store.byMemberId).length === 0) {
    await AsyncStorage.multiRemove([SIDEKICK_SESSION_KEY_V2, SIDEKICK_SESSION_KEY_V1]);
    return;
  }
  await writeStore(store);
}

/** Bump last-connected timestamp after a successful sync or before sign-out. */
export async function touchSidekickSession(): Promise<void> {
  const session = await loadSidekickSession();
  if (!session) return;
  await saveSidekickSessionFor(session.memberId, {
    ...session,
    lastConnectedAt: new Date().toISOString(),
  });
}

/** Wipe every profile on this device — factory reset / Settings only. Never call on switch. */
export async function clearSidekickSession(): Promise<void> {
  await AsyncStorage.multiRemove([SIDEKICK_SESSION_KEY_V2, SIDEKICK_SESSION_KEY_V1]);
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

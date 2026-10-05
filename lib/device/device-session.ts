import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeviceHostKind } from '@/lib/device/device-host';

const KEY = 'orbit.deviceSession.v1';

/** Physical-device binding: personal phone vs shared iPad hosting multiple profiles. */
export type DeviceSession = {
  mode: 'personal' | 'shared';
  /** Personal Sidekick vs household shared iPad (multi-profile picker). */
  hostKind?: DeviceHostKind;
  /** Member ids hosted on this device (from scanned/entered profile codes). */
  profileMemberIds: string[];
  /** Last selected profile — cleared when needsProfilePick is true. */
  activeMemberId: string | null;
  /** Netflix-style picker required before entering the main app. */
  needsProfilePick: boolean;
  deviceLabel?: string;
  /** Optional household shared-device shell id when linked. */
  sharedDeviceId?: string | null;
};

const EMPTY: DeviceSession = {
  mode: 'personal',
  hostKind: undefined,
  profileMemberIds: [],
  activeMemberId: null,
  needsProfilePick: false,
  deviceLabel: undefined,
  sharedDeviceId: null,
};

export async function loadDeviceSession(): Promise<DeviceSession> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<DeviceSession>;
    return {
      mode: parsed.mode === 'shared' ? 'shared' : 'personal',
      hostKind:
        parsed.hostKind === 'sidekick' || parsed.hostKind === 'shared-tablet'
          ? parsed.hostKind
          : undefined,
      profileMemberIds: Array.isArray(parsed.profileMemberIds)
        ? parsed.profileMemberIds.filter((id): id is string => typeof id === 'string')
        : [],
      activeMemberId: typeof parsed.activeMemberId === 'string' ? parsed.activeMemberId : null,
      needsProfilePick: Boolean(parsed.needsProfilePick),
      deviceLabel: typeof parsed.deviceLabel === 'string' ? parsed.deviceLabel : undefined,
      sharedDeviceId: typeof parsed.sharedDeviceId === 'string' ? parsed.sharedDeviceId : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function saveDeviceSession(session: DeviceSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearDeviceSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** True when this device hosts multiple profiles (shared iPad or family Sidekick phone). */
export function isSharedTabletDeviceSession(session: DeviceSession | null | undefined): boolean {
  if (!session || session.mode !== 'shared') return false;
  if (session.profileMemberIds.length > 1) return true;
  if (session.hostKind === 'sidekick') return false;
  if (session.hostKind === 'shared-tablet') return session.profileMemberIds.length > 0;
  if (session.sharedDeviceId) return true;
  return session.profileMemberIds.length > 1;
}

/** Mark that the next cold entry should show Who's watching? */
export async function markNeedsProfilePick(): Promise<DeviceSession> {
  const current = await loadDeviceSession();
  if (current.mode !== 'shared' || current.profileMemberIds.length === 0) {
    return current;
  }
  const next: DeviceSession = {
    ...current,
    activeMemberId: null,
    needsProfilePick: true,
  };
  await saveDeviceSession(next);
  return next;
}

export async function removeHostedProfile(memberId: string): Promise<DeviceSession> {
  const current = await loadDeviceSession();
  const nextIds = current.profileMemberIds.filter((id) => id !== memberId);
  const next: DeviceSession = {
    ...current,
    profileMemberIds: nextIds,
    activeMemberId: current.activeMemberId === memberId ? null : current.activeMemberId,
    needsProfilePick: nextIds.length > 0,
    mode: nextIds.length > 0 ? 'shared' : 'personal',
  };
  if (nextIds.length === 0) {
    await clearDeviceSession();
    return { ...EMPTY };
  }
  await saveDeviceSession(next);
  return next;
}

export async function selectDeviceProfile(memberId: string): Promise<DeviceSession> {
  const current = await loadDeviceSession();
  const next: DeviceSession = {
    ...current,
    mode: 'shared',
    activeMemberId: memberId,
    needsProfilePick: false,
    profileMemberIds: current.profileMemberIds.includes(memberId)
      ? current.profileMemberIds
      : [...current.profileMemberIds, memberId],
  };
  await saveDeviceSession(next);
  return next;
}

export async function setupSharedDeviceSession(input: {
  profileMemberIds: string[];
  deviceLabel?: string;
  sharedDeviceId?: string | null;
  hostKind?: DeviceHostKind;
}): Promise<DeviceSession> {
  const unique = [...new Set(input.profileMemberIds.filter(Boolean))];
  const hostKind = input.hostKind ?? 'shared-tablet';
  const isSidekickHost = hostKind === 'sidekick';
  const next: DeviceSession = {
    mode: 'shared',
    hostKind,
    profileMemberIds: unique,
    activeMemberId: null,
    needsProfilePick:
      unique.length > 1 ? true : isSidekickHost ? false : unique.length > 0,
    deviceLabel: input.deviceLabel?.trim() || (isSidekickHost ? 'Sidekick device' : 'Shared device'),
    sharedDeviceId: input.sharedDeviceId ?? null,
  };
  await saveDeviceSession(next);
  return next;
}

/**
 * Add a profile to this device without wiping siblings.
 * First profile bootstraps shared mode; later joins only append + select.
 */
export function mergeHostedProfileMemberIds(
  deviceIds: string[],
  sidekickMemberIds: string[]
): string[] {
  return [...new Set([...deviceIds, ...sidekickMemberIds].filter(Boolean))];
}

/**
 * Keep DeviceSession.profileMemberIds aligned with Sidekick v2 and (when
 * `members` is passed) the shared-tablet roster from Settings.
 * Call before the face picker and after hosting a profile.
 */
export async function reconcileHostedDeviceSession(
  members?: import('@/types/orbit').HouseholdMember[]
): Promise<DeviceSession> {
  const current = await loadDeviceSession();
  const { listSidekickSessions } = await import('@/lib/sidekick/session');
  const sidekickIds = (await listSidekickSessions()).map((item) => item.memberId);
  let merged = mergeHostedProfileMemberIds(current.profileMemberIds, sidekickIds);

  let rosterSharedDeviceId = current.sharedDeviceId ?? null;
  let rosterLabel = current.deviceLabel;
  if (members && members.length > 0) {
    const { profilesForSharedDeviceSwitch, resolveSwitchDeviceShell } = await import(
      '@/lib/device/profiles-for-switch'
    );
    const shell = resolveSwitchDeviceShell(
      { ...current, profileMemberIds: merged.length ? merged : current.profileMemberIds },
      members
    );
    const rosterIds = profilesForSharedDeviceSwitch(
      {
        ...current,
        profileMemberIds: merged.length ? merged : current.profileMemberIds,
      },
      members
    ).map((person) => person.id);
    if (rosterIds.length > 0) {
      merged = mergeHostedProfileMemberIds(merged, rosterIds);
    }
    if (shell) {
      rosterSharedDeviceId = current.sharedDeviceId ?? shell.id;
      rosterLabel = current.deviceLabel?.trim() || shell.name;
    }
  }

  if (merged.length === 0) {
    return current;
  }

  const preserveActive =
    Boolean(current.activeMemberId) &&
    merged.includes(current.activeMemberId!) &&
    !current.needsProfilePick;

  if (merged.length === 1) {
    const sole = merged[0]!;
    const unchanged =
      current.mode === 'shared' &&
      current.profileMemberIds.length === 1 &&
      current.profileMemberIds[0] === sole &&
      current.hostKind !== 'shared-tablet';
    if (unchanged) return current;
    const next: DeviceSession = {
      ...current,
      mode: 'shared',
      hostKind: current.hostKind ?? 'sidekick',
      profileMemberIds: [sole],
      needsProfilePick: current.needsProfilePick && current.profileMemberIds.includes(sole),
    };
    await saveDeviceSession(next);
    return next;
  }

  const sameIds =
    current.profileMemberIds.length === merged.length &&
    merged.every((id) => current.profileMemberIds.includes(id));
  if (
    sameIds &&
    current.mode === 'shared' &&
    current.hostKind === 'shared-tablet' &&
    (current.sharedDeviceId ?? null) === (rosterSharedDeviceId ?? null)
  ) {
    return current;
  }

  await setupSharedDeviceSession({
    profileMemberIds: merged,
    deviceLabel: rosterLabel?.trim() || 'Family device',
    hostKind: 'shared-tablet',
    sharedDeviceId: rosterSharedDeviceId,
  });
  if (current.needsProfilePick) {
    const withPick: DeviceSession = {
      ...(await loadDeviceSession()),
      activeMemberId: null,
      needsProfilePick: true,
    };
    await saveDeviceSession(withPick);
    return withPick;
  }
  if (preserveActive) {
    return selectDeviceProfile(current.activeMemberId!);
  }
  return loadDeviceSession();
}

export async function hostProfileOnDevice(input: {
  memberId: string;
  deviceLabel?: string;
  hostKind?: DeviceHostKind;
  sharedDeviceId?: string | null;
}): Promise<DeviceSession> {
  const current = await loadDeviceSession();
  if (current.mode === 'shared' && current.profileMemberIds.length > 0) {
    await selectDeviceProfile(input.memberId);
  } else {
    await setupSharedDeviceSession({
      profileMemberIds: [input.memberId],
      deviceLabel: input.deviceLabel,
      hostKind: input.hostKind ?? 'sidekick',
      sharedDeviceId: input.sharedDeviceId,
    });
    await selectDeviceProfile(input.memberId);
  }
  return reconcileHostedDeviceSession();
}

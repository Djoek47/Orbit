import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'orbit.deviceSession.v1';

/** Physical-device binding: personal phone vs shared/kid tablet hosting multiple profiles. */
export type DeviceSession = {
  mode: 'personal' | 'shared';
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
}): Promise<DeviceSession> {
  const unique = [...new Set(input.profileMemberIds.filter(Boolean))];
  const next: DeviceSession = {
    mode: 'shared',
    profileMemberIds: unique,
    activeMemberId: null,
    needsProfilePick: unique.length > 0,
    deviceLabel: input.deviceLabel?.trim() || 'Shared tablet',
    sharedDeviceId: input.sharedDeviceId ?? null,
  };
  await saveDeviceSession(next);
  return next;
}

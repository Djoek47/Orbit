/**
 * What a shared tablet remembers after someone signs it out.
 *
 * Signing out used to wipe every face. The tablet then woke up on the welcome screen as
 * whichever child's session was left over — "Continue as Jack" — on a device that belongs to
 * the house, not to Jack. Now the tablet keeps the device, and offers it back as the device:
 * "Continue with The Nero Home shared device", which lands on the faces.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'orbit.sharedDeviceResume.v1';

export type SharedDeviceResume = {
  householdName: string;
  deviceLabel: string;
  memberIds: string[];
  sharedDeviceId: string | null;
  signedOutAt: string;
};

export function continueSharedDeviceLabel(resume: Pick<SharedDeviceResume, 'householdName'>): string {
  const name = resume.householdName.trim();
  return name ? `Continue with ${name} shared device` : 'Continue with this shared device';
}

export function isUsableResume(value: unknown): value is SharedDeviceResume {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SharedDeviceResume>;
  return (
    typeof v.householdName === 'string' &&
    Array.isArray(v.memberIds) &&
    v.memberIds.some((id) => typeof id === 'string' && id.length > 0)
  );
}

export async function saveSharedDeviceResume(
  resume: Omit<SharedDeviceResume, 'signedOutAt'>
): Promise<void> {
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify({ ...resume, signedOutAt: new Date().toISOString() } satisfies SharedDeviceResume)
  );
}

export async function loadSharedDeviceResume(): Promise<SharedDeviceResume | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isUsableResume(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearSharedDeviceResume(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

/**
 * Shared-device notification tap → open as the face the push concerns.
 */
import type { DeviceSession } from '@/lib/device/device-session';

export function shouldOpenNotificationAsMember(input: {
  targetMemberId: string | null | undefined;
  currentMemberId: string | null | undefined;
  session: DeviceSession | null | undefined;
}): boolean {
  const target = input.targetMemberId?.trim();
  if (!target) return false;
  if (target === input.currentMemberId) return false;
  const session = input.session;
  if (!session || session.mode !== 'shared') return false;
  if (session.profileMemberIds.length > 1) return true;
  if (session.hostKind === 'shared-tablet') return true;
  // Hosted list may lag; still switch when the target is already on the device.
  return session.profileMemberIds.includes(target);
}

export function targetMemberIdFromPushData(data: Record<string, unknown>): string | null {
  if (typeof data.targetMemberId === 'string' && data.targetMemberId.trim()) {
    return data.targetMemberId.trim();
  }
  if (typeof data.memberId === 'string' && data.memberId.trim()) {
    return data.memberId.trim();
  }
  return null;
}

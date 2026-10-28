/**
 * User-facing copy when a shared tablet already has six people.
 * Keep every surface on the same polite, clear message.
 */
import { SHARED_DEVICE_MAX_PEOPLE } from '@/lib/household/shared-device';

export function sharedDeviceFullTitle(): string {
  return 'This tablet is full';
}

export function sharedDeviceFullMessage(deviceName?: string | null): string {
  const name = deviceName?.trim() || 'this shared device';
  return (
    `${name} can share with up to ${SHARED_DEVICE_MAX_PEOPLE} people. ` +
    `Remove someone first, or set up another shared device for the next person.`
  );
}

/** Short inline hint under the roster when at capacity. */
export function sharedDeviceFullHint(): string {
  return (
    `Up to ${SHARED_DEVICE_MAX_PEOPLE} people on one tablet. ` +
    `Free a spot or add another shared device for someone else.`
  );
}

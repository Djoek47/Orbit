/**
 * Local Expo module: drain Lock Screen grocery check-offs from the App Group store.
 * Null when the native side isn't in this build (Expo Go / older binary).
 */
import { requireOptionalNativeModule } from 'expo';

type NativeModule = {
  drainPendingCheckOffIds(): string[];
  pendingCheckOffIds(): string[];
};

const native = requireOptionalNativeModule<NativeModule>('ShoppingBannerBridge');

/** Item ids checked off on the Lock Screen since the app last drained. */
export function drainLockScreenCheckOffs(): string[] {
  try {
    return native?.drainPendingCheckOffIds() ?? [];
  } catch {
    return [];
  }
}

export function peekLockScreenCheckOffs(): string[] {
  try {
    return native?.pendingCheckOffIds() ?? [];
  } catch {
    return [];
  }
}

export function lockScreenCheckOffAvailable(): boolean {
  return native != null;
}

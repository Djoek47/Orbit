/**
 * Native WebRTC close + live household snapshot (no React Native imports).
 */

import type { HouseholdSnapshot } from '@/types/orbit';

/** Wait for RTCView to unmount before PeerConnection.close — closing first SIGSEGVs Hermes. */
export const VOICE_NATIVE_CLOSE_MS = 120;

/**
 * Extra quiet time after `pc.close()` so the void TurboModule (and any
 * `convertNSExceptionToJSError`) finishes before React unmounts. IPA 49
 * B88D6E93 crashed Hermes HiddenClass::addProperty 160ms after close.
 */
export const VOICE_NATIVE_SETTLE_MS = 280;

export const VOICE_TEARDOWN_SETTLE_MS = VOICE_NATIVE_CLOSE_MS + VOICE_NATIVE_SETTLE_MS;

let nativeClosePendingUntil = 0;
let voiceAudioEpoch = 0;

export function markVoiceNativeClosePending(now = Date.now()) {
  nativeClosePendingUntil = Math.max(nativeClosePendingUntil, now + VOICE_TEARDOWN_SETTLE_MS);
}

/** Bump when a new Speak starts so a delayed close cannot restore the previous audio session. */
export function beginVoiceAudioEpoch(): number {
  voiceAudioEpoch += 1;
  return voiceAudioEpoch;
}

export function currentVoiceAudioEpoch(): number {
  return voiceAudioEpoch;
}

export function remainingVoiceSettleMs(now = Date.now()) {
  return Math.max(0, nativeClosePendingUntil - now);
}

export function resetVoiceNativeClosePendingForTests() {
  nativeClosePendingUntil = 0;
  voiceAudioEpoch = 0;
}

export async function waitForPendingVoiceNativeSettle(): Promise<void> {
  const remaining = remainingVoiceSettleMs();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

export function resolveLiveVoiceHousehold(
  cached: HouseholdSnapshot | null,
  getHousehold?: () => HouseholdSnapshot | null | undefined
): HouseholdSnapshot | null {
  try {
    return getHousehold?.() ?? cached;
  } catch {
    return cached;
  }
}

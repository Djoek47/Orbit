/**
 * Voice failure copy — specific, calm, recoverable.
 * Never pass SDK / HTTP dumps to the surface.
 */

export type IuiVoiceErrorKind =
  | 'mic_denied'
  | 'signed_out'
  | 'offline'
  | 'needs_testflight'
  | 'unavailable'
  | 'generic';

export function classifyIuiVoiceError(raw: unknown): IuiVoiceErrorKind {
  const text = String(raw ?? '').toLowerCase();
  if (!text.trim()) return 'generic';
  if (
    /notallowed|permission denied|denied permission|microphone.*denied|audio.*denied/.test(text)
  ) {
    return 'mic_denied';
  }
  if (/sign in required|not authenticated|jwt|unauthorized/.test(text)) {
    return 'signed_out';
  }
  if (
    /network request failed|failed to fetch|offline|timed out|timeout|err_ngrok|internet/.test(text)
  ) {
    return 'offline';
  }
  if (/webrtc|testflight|native poppins voice is not enabled/.test(text)) {
    return 'needs_testflight';
  }
  if (/sdp failed|realtime sdp/.test(text)) {
    return 'unavailable';
  }
  return 'generic';
}

export function iuiVoiceErrorCopy(kind: IuiVoiceErrorKind): string {
  switch (kind) {
    case 'mic_denied':
      return 'Microphone is off. Type instead.';
    case 'signed_out':
      return 'Sign in to speak with Poppins.';
    case 'offline':
      return 'Poppins is unreachable. Type instead.';
    case 'needs_testflight':
      return 'Voice needs the TestFlight app. Type instead.';
    case 'unavailable':
      return 'Poppins could not start voice. Type instead.';
    default:
      return 'Poppins could not start. Type instead.';
  }
}

/** Voice failed — keep the tab usable. */
export function shouldOfferKeyboard(kind: IuiVoiceErrorKind): boolean {
  return kind !== 'signed_out';
}

export function copyIuiVoiceError(raw: unknown): {
  kind: IuiVoiceErrorKind;
  message: string;
  offerKeyboard: boolean;
} {
  const kind = classifyIuiVoiceError(raw);
  return {
    kind,
    message: iuiVoiceErrorCopy(kind),
    offerKeyboard: shouldOfferKeyboard(kind),
  };
}

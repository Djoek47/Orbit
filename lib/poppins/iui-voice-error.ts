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
  if (/sdp failed \(402\)|voice_not_allowed|payment required/.test(text)) {
    return 'unavailable';
  }
  if (
    /network request failed|failed to fetch|offline|timed out|timeout|err_ngrok|internet/.test(text)
  ) {
    return 'offline';
  }
  if (/webrtc|testflight|native poppins voice is not enabled/.test(text)) {
    return 'needs_testflight';
  }
  if (
    /sdp failed|realtime sdp|realtime error|invalid_request|unknown_parameter|modalities|model_not_found/.test(
      text
    )
  ) {
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
      return "Couldn't reach Poppins. Tap Speak to try again.";
    case 'needs_testflight':
      return 'Voice needs the TestFlight app. Type instead.';
    case 'unavailable':
      return "Couldn't start voice. Tap Speak to try again.";
    default:
      return "Couldn't start voice. Tap Speak to try again.";
  }
}

/** Offer the Type door. Only mic-denied forces the keyboard open. */
export function shouldOfferKeyboard(kind: IuiVoiceErrorKind): boolean {
  return kind === 'mic_denied' || kind === 'needs_testflight';
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

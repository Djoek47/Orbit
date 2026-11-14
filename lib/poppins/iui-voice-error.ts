/**
 * Voice failure copy — calm retry line plus the raw debug dump.
 * The dump stays on screen so a second Speak try can tell SDP / gum / IUI / memory apart.
 */

export type IuiVoiceErrorKind =
  | 'mic_denied'
  | 'signed_out'
  | 'offline'
  | 'needs_testflight'
  | 'unavailable'
  | 'generic';

const DETAIL_MAX = 480;

function compactVoiceText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, DETAIL_MAX);
}

/** Flatten Error / JSON / HTTP bodies into one selectable debug line. */
export function stringifyVoiceError(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return compactVoiceText(raw);
  if (raw instanceof Error) {
    const code =
      'code' in raw && raw.code != null && String(raw.code).trim() ? String(raw.code) : '';
    return compactVoiceText([raw.name, code, raw.message].filter(Boolean).join(': '));
  }
  if (typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const nested = rec.error;
    if (nested && typeof nested === 'object') {
      const n = nested as Record<string, unknown>;
      const bits = [n.status, n.code, n.type, n.message].filter(
        (value) => value != null && String(value).trim()
      );
      if (bits.length) return compactVoiceText(bits.map(String).join(' · '));
    }
    try {
      return compactVoiceText(JSON.stringify(raw));
    } catch {
      return compactVoiceText(String(raw));
    }
  }
  return compactVoiceText(String(raw));
}

export function classifyIuiVoiceError(raw: unknown): IuiVoiceErrorKind {
  const text = stringifyVoiceError(raw).toLowerCase();
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
  detail: string;
  offerKeyboard: boolean;
} {
  const kind = classifyIuiVoiceError(raw);
  const short = iuiVoiceErrorCopy(kind);
  const detail = stringifyVoiceError(raw);
  const message =
    detail && detail.toLowerCase() !== short.toLowerCase() ? `${short}\n${detail}` : short;
  return {
    kind,
    message,
    detail,
    offerKeyboard: shouldOfferKeyboard(kind),
  };
}

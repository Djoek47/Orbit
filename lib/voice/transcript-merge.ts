/** Keep a natural caption: never replace a longer line with a shorter partial. */

export function mergeTranscript(previous: string, next: string): string {
  const prev = previous.trim();
  const incoming = next.trim();
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming === prev) return prev;
  if (incoming.startsWith(prev) || prev.startsWith(incoming)) {
    return incoming.length >= prev.length ? incoming : prev;
  }
  if (prev.includes(incoming) && incoming.length < prev.length) return prev;
  return incoming;
}

/** Visible live-caption window — 3 short lines above the orb. */
export const LIVE_CAPTION_DISPLAY_MAX = 140;
/** Stored window so merge still has a little prefix context. */
export const LIVE_CAPTION_STORE_MAX = 280;

export type LiveCaptionSpeaker = 'you' | 'poppins';

export type LiveCaption = {
  speaker: LiveCaptionSpeaker;
  text: string;
};

/** Keep the latest words so a long turn never covers the orb. */
export function captionWindow(text: string, max = LIVE_CAPTION_DISPLAY_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const slice = t.slice(-max);
  const sentence = slice.match(/[.!?]\s+(\S[\s\S]*)$/);
  const body =
    sentence?.[1] && sentence[1].length >= 24
      ? sentence[1].trim()
      : (() => {
          const word = slice.search(/\s/);
          return word > 0 && word < 48 ? slice.slice(word + 1).trim() : slice.trim();
        })();
  return `…${body}`;
}

/** One speaker at a time: a new turn erases the other person's caption. */
export function applyLiveCaptionTurn(
  prev: LiveCaption | null,
  speaker: LiveCaptionSpeaker,
  incoming: string,
  replace = false
): LiveCaption {
  const same = prev?.speaker === speaker;
  const trimmed = incoming.trim();
  if (!trimmed) {
    return { speaker, text: same && !replace ? (prev?.text ?? '') : '' };
  }
  const merged = replace || !same ? trimmed : mergeTranscript(prev?.text ?? '', trimmed);
  return { speaker, text: captionWindow(merged, LIVE_CAPTION_STORE_MAX) };
}

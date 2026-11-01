/**
 * Utterance endpointer for Base listening.
 *
 * The iPhone recognizer, in continuous mode, hands back the whole session's transcript on
 * every update ("add milk" → "add milk and eggs" → "add milk and eggs then call mom").
 * Base needs sentences: this decides when the person has finished one, and hands back only
 * the words that are new since the last sentence it emitted.
 *
 * Rules
 *  - A sentence ends after `silenceMs` without the transcript changing.
 *  - If the words so far end on glue ("…and", "…for", "…at", "…then"), wait `hangMs` —
 *    people pause mid-thought right there.
 *  - A native "final" result ends the sentence at once.
 *  - The recognizer may revise earlier words; the endpointer tracks by word count, so a
 *    revision inside an already-emitted sentence never re-emits it.
 *
 * Pure: time comes in through `now`.
 */

export type EndpointerOptions = {
  silenceMs?: number;
  hangMs?: number;
};

export type EndpointerFeed = {
  /** Words heard since the last emitted sentence (for the live line). */
  live: string;
  /** Present when a sentence just ended. */
  utterance?: string;
};

const GLUE = new Set([
  // joining words
  'and', 'then', 'for', 'to', 'at', 'on', 'with', 'the', 'a', 'an', 'my', 'our', 'of', 'in',
  'from', 'until', 'by', 'or', 'but', 'also', 'plus', 'into', 'onto', 'about', 'like', 'as',
  'than', 'that', 'which', 'who', 'if', 'when', 'because', 'so', 'before', 'after', 'every',
  'each', 'next', 'this', 'these', 'those', 'his', 'her', 'their', 'its', 'your', 'some',
  // a verb still waiting for its object ("…should be", "…name is", "…remind Mia to")
  'be', 'is', 'are', 'was', 'were', 'should', 'would', 'could', 'will', 'can', 'need', 'needs',
  'want', 'wants', 'have', 'has', 'get', 'gets', 'got', 'gonna', 'going', 'called', 'named',
  'add', 'put', 'assign', 'remind', 'make', 'schedule', 'call', 'rename', 'move', 'give',
  'buy', 'set', 'change', 'delete', 'remove',
  // fillers people say while thinking
  'um', 'uh', 'er', 'erm', 'hmm', 'like',
  // French
  'et', 'puis', 'pour', 'à', 'avec', 'de', 'le', 'la', 'les', 'un', 'une', 'du', 'des', 'au',
  'aux', 'sur', 'chez', 'que', 'est',
]);

function words(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function endsOnGlue(text: string): boolean {
  const w = words(text);
  const last = w[w.length - 1]?.toLowerCase().replace(/[^\p{L}']/gu, '');
  if (!last) return false;
  if (GLUE.has(last)) return true;
  // "…the appointment's" / "…name's" — a contraction still waiting for the rest.
  if (/'s$/.test(last) && w.length > 1) return true;
  return false;
}

/**
 * The words so far can't be a whole request yet: they end on glue, or they are only an
 * opener ("hey Poppins", "can you", "so"). Poppins keeps listening instead of acting on half
 * a sentence.
 */
export function looksUnfinished(text: string): boolean {
  if (endsOnGlue(text)) return true;
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return /^(?:(?:hey|hi|ok(?:ay)?|so|um+|uh+|and|also|please|bonjour|salut)\s*)*(?:poppins|nova)?\s*(?:can you|could you|would you|i want to|i need to|i'd like to|est-ce que tu peux|peux-tu)?$/.test(t);
}

export function createEndpointer(opts: EndpointerOptions = {}) {
  // People pause to think mid-request. 1.1 s cut "for next week… the appointment's name should
  // be… buy a car" into three requests; a finished thought still goes in under 1.5 s.
  const silenceMs = opts.silenceMs ?? 1400;
  const hangMs = opts.hangMs ?? 2800;
  let committed = 0; // words already emitted from the current native session
  let current: string[] = [];
  let lastChangeAt = 0;

  const pending = () => current.slice(committed).join(' ');

  const emit = (): string | undefined => {
    const text = pending().trim();
    committed = Math.max(committed, current.length);
    return text || undefined;
  };

  return {
    /** A new transcript from the recognizer. */
    feed(transcript: string, isFinal: boolean, now: number): EndpointerFeed {
      const next = words(transcript);
      const changed = next.join(' ') !== current.join(' ');
      current = next;
      if (committed > current.length) committed = current.length;
      if (changed) lastChangeAt = now;
      if (isFinal) {
        // The recognizer calls a pause "final" even mid-thought. Only a finished-looking
        // sentence ends here; otherwise the tick waits the longer hang for the rest.
        if (looksUnfinished(pending())) return { live: pending() };
        const utterance = emit();
        return { live: '', utterance };
      }
      return { live: pending() };
    },

    /** Call on a timer (~150 ms). Emits when the person has paused long enough. */
    tick(now: number): EndpointerFeed {
      const live = pending();
      if (!live.trim()) return { live: '' };
      const wait = looksUnfinished(live) ? hangMs : silenceMs;
      if (now - lastChangeAt < wait) return { live };
      return { live: '', utterance: emit() };
    },

    /** Flush whatever is pending (the person tapped to close mid-sentence). */
    flush(): string | undefined {
      return emit();
    },

    /** The recognizer restarted: its next transcript starts from zero. */
    reset() {
      committed = 0;
      current = [];
      lastChangeAt = 0;
    },

    /** Milliseconds since the transcript last changed (0 if nothing heard yet). */
    quietFor(now: number): number {
      return lastChangeAt ? now - lastChangeAt : 0;
    },

    get heardAnything(): boolean {
      return lastChangeAt > 0;
    },
  };
}

export type Endpointer = ReturnType<typeof createEndpointer>;

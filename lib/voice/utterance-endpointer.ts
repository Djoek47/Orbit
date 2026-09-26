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
  'and', 'then', 'for', 'to', 'at', 'on', 'with', 'the', 'a', 'an', 'my', 'our', 'of', 'in',
  'from', 'until', 'by', 'or', 'but', 'also', 'plus', 'et', 'puis', 'pour', 'à', 'avec', 'de',
  'le', 'la', 'les', 'un', 'une',
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
  return Boolean(last && GLUE.has(last));
}

export function createEndpointer(opts: EndpointerOptions = {}) {
  const silenceMs = opts.silenceMs ?? 1100;
  const hangMs = opts.hangMs ?? 2200;
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
        const utterance = emit();
        return { live: '', utterance };
      }
      return { live: pending() };
    },

    /** Call on a timer (~150 ms). Emits when the person has paused long enough. */
    tick(now: number): EndpointerFeed {
      const live = pending();
      if (!live.trim()) return { live: '' };
      const wait = endsOnGlue(live) ? hangMs : silenceMs;
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

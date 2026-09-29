/**
 * Base session — the small decisions around a listening session that aren't about the act
 * itself: what a listening failure should say, when a sentence means "we're done", and how
 * to re-read a sentence the grammar missed once the person says which kind of thing it is.
 *
 * Copy rules (owner's): Poppins never says "UI". The listening problem gets its real name
 * and one thing to do about it.
 */
import type { BaseListenFailure } from '@/lib/voice/base-listener';

export type BaseTroubleAction = 'settings' | 'again' | 'type';

export type BaseTrouble = {
  kind: 'listen' | 'silent' | 'unknown';
  title: string;
  reason: string;
  action?: BaseTroubleAction;
  /** What was heard, when the trouble is about a sentence. */
  heard?: string;
};

export function baseTroubleForFailure(reason: BaseListenFailure): BaseTrouble {
  switch (reason) {
    case 'permission':
      return {
        kind: 'listen',
        title: "Poppins can't hear you yet",
        reason: 'Allow Microphone and Speech Recognition for Choremaxx in Settings.',
        action: 'settings',
      };
    case 'unavailable':
      return {
        kind: 'listen',
        title: 'Speech recognition is off',
        reason:
          'Turn on Siri & Dictation in Settings, or type below. This build may also need updating from TestFlight.',
        action: 'type',
      };
    case 'language':
      return {
        kind: 'listen',
        title: "This language isn't available for listening",
        reason: 'Poppins listens in English and French. You can type below.',
        action: 'type',
      };
    case 'network':
      return {
        kind: 'listen',
        title: 'Listening needs a connection on this iPhone',
        reason: 'Older iPhones send speech to Apple to write it down. Reconnect, or type below.',
        action: 'again',
      };
    case 'audio':
      return {
        kind: 'listen',
        title: 'The microphone is busy',
        reason: 'Another app or a call is using it. Close it and tap the mic again.',
        action: 'again',
      };
    default:
      return {
        kind: 'listen',
        title: 'Listening stopped',
        reason: 'Tap the mic to start again.',
        action: 'again',
      };
  }
}

export const SILENT_START_TROUBLE: BaseTrouble = {
  kind: 'silent',
  title: "I didn't hear words",
  reason: "Tap the mic and talk — I'll write down what I hear.",
  action: 'again',
};

export function unknownSentenceTrouble(heard: string): BaseTrouble {
  return {
    kind: 'unknown',
    title: 'What should I do with that?',
    reason: `I heard "${heard.length > 80 ? `${heard.slice(0, 77)}…` : heard}".`,
    heard,
  };
}

function norm(text: string) {
  return text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const END_PHRASES = [
  "that's all", 'that is all', "that's it", 'that is it', "that's everything", "i'm done",
  'i am done', "we're done", 'we are done', 'nothing else', 'no more', 'stop listening',
  'close', 'close it', 'goodbye', 'bye', 'bye bye', 'thanks', 'thank you', "thanks that's all",
  "thank you that's all", "that's all thanks", "that's all thank you", 'all done',
  "c'est tout", "c'est bon", 'merci', "merci c'est tout", 'ça sera tout', 'ca sera tout',
  'fini', "j'ai fini", 'au revoir',
];

/** A whole sentence that only means "we're finished" — never a sentence that also asks for something. */
export function isEndOfSessionUtterance(text: string): boolean {
  const t = norm(text).replace(/^(ok|okay|alright|all right|great|perfect|cool|super|parfait)\s+/, '');
  return END_PHRASES.includes(t);
}

export type ReframeFamily = 'chore' | 'grocery' | 'event';

/** Re-read a sentence as the kind of thing the person just said it was. */
export function reframeUtterance(text: string, family: ReframeFamily): string {
  const t = text.trim().replace(/[.!?]+$/, '');
  switch (family) {
    case 'chore':
      return `add a task to ${t}`;
    case 'grocery':
      return `add ${t} to the grocery list`;
    case 'event':
      return `put ${t} on the calendar`;
  }
}

export const REFRAME_CHIPS: Array<{ id: ReframeFamily; label: string }> = [
  { id: 'chore', label: 'A chore' },
  { id: 'grocery', label: 'Groceries' },
  { id: 'event', label: 'The calendar' },
];

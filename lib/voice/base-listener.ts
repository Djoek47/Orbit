/**
 * Base listening — the iPhone's own speech recognizer, streaming.
 *
 * Base is Max without the voice: it hears you, writes down what it heard, and drives the
 * stage. Nothing is uploaded and nothing talks back, so there is no server to be
 * unreachable and no per-minute cost. On a phone that supports it, recognition runs fully
 * on device.
 *
 * One session lasts until the person taps to close (or goes quiet for a while). Inside it,
 * the endpointer cuts the running transcript into sentences; each sentence is handed to
 * `onUtterance`. The native recognizer ends itself now and then (iOS caps a request at
 * about a minute, and some errors end it) — the listener restarts it transparently.
 */
import { createEndpointer, type Endpointer } from '@/lib/voice/utterance-endpointer';

export type BaseListenFailure =
  | 'permission'
  | 'unavailable'
  | 'language'
  | 'network'
  | 'audio'
  | 'interrupted'
  | 'busy'
  | 'unknown';

export type BaseListenerHandlers = {
  /** Words heard since the last sentence, as they arrive. */
  onLive: (text: string) => void;
  /** A finished sentence. */
  onUtterance: (text: string) => void;
  /** Input level 0..1 for the listening animation. */
  onLevel?: (level: number) => void;
  /** Listening stopped for good because of a problem. */
  onFailure: (reason: BaseListenFailure, detail: string) => void;
  /** Listening stopped (by `stop()`, by a failure, or after going quiet). */
  onEnded?: (why: 'stopped' | 'failure' | 'idle' | 'silent_start') => void;
};

export type BaseListenerOptions = {
  locale?: string;
  /** Names and words the recognizer should favour: members, chores, places, groceries. */
  vocabulary?: string[];
  /** End the session after this long with no new words, once something was heard. */
  idleCloseMs?: number;
  /** End the session if nothing at all is heard for this long after starting. */
  silentStartMs?: number;
  /** Hold the session open while this returns true (a card is on stage). */
  keepOpen?: () => boolean;
  silenceMs?: number;
  hangMs?: number;
};

type Subscription = { remove: () => void };

/** The slice of expo-speech-recognition this file uses — injectable for tests. */
export type SpeechNative = {
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  isRecognitionAvailable: () => boolean;
  supportsOnDeviceRecognition: () => boolean;
  addListener: (event: string, listener: (payload: never) => void) => Subscription;
};

let nativeOverride: SpeechNative | null | undefined;

/** Tests: swap the native module. `null` simulates a build without it. */
export function setSpeechNativeForTests(native: SpeechNative | null | undefined) {
  nativeOverride = native;
}

export function loadSpeechNative(): SpeechNative | null {
  if (nativeOverride !== undefined) return nativeOverride;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: SpeechNative;
    };
    return mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

/** True when this build can listen at all (the native module is present). */
export function baseListeningAvailable(): boolean {
  const native = loadSpeechNative();
  if (!native) return false;
  try {
    return native.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function failureFromNativeError(code: string): BaseListenFailure | 'ignore' {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
    case 'aborted':
      return 'ignore';
    case 'not-allowed':
      return 'permission';
    case 'service-not-allowed':
      return 'unavailable';
    case 'language-not-supported':
      return 'language';
    case 'network':
      return 'network';
    case 'audio-capture':
      return 'audio';
    case 'interrupted':
      return 'interrupted';
    case 'busy':
      return 'busy';
    default:
      return 'unknown';
  }
}

/** The recognizer's language: the phone's, when it is one we speak. */
export function listenLocale(deviceLocale?: string): string {
  const raw = (deviceLocale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US').replace('_', '-');
  if (/^fr/i.test(raw)) return /-/.test(raw) ? raw : 'fr-CA';
  if (/^en/i.test(raw)) return /-/.test(raw) ? raw : 'en-US';
  return 'en-US';
}

/** De-duplicated, short, capped: the recognizer only takes so much. */
export function vocabularyFor(words: Array<string | undefined | null>, cap = 100): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words) {
    const word = (raw ?? '').trim();
    if (!word || word.length > 40) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= cap) break;
  }
  return out;
}

export class BaseListener {
  private native: SpeechNative | null;
  private subs: Subscription[] = [];
  private endpointer: Endpointer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers: BaseListenerHandlers | null = null;
  private opts: BaseListenerOptions = {};
  private startedAt = 0;
  private lastSentenceAt = 0;
  private restarting = false;
  private restarts = 0;
  active = false;

  constructor(private now: () => number = () => Date.now()) {
    this.native = loadSpeechNative();
    this.endpointer = createEndpointer();
  }

  async start(handlers: BaseListenerHandlers, opts: BaseListenerOptions = {}): Promise<boolean> {
    if (this.active) return true;
    this.handlers = handlers;
    this.opts = opts;
    this.endpointer = createEndpointer({ silenceMs: opts.silenceMs, hangMs: opts.hangMs });
    const native = this.native;
    if (!native) {
      handlers.onFailure('unavailable', 'speech module missing from this build');
      return false;
    }
    try {
      if (!native.isRecognitionAvailable()) {
        handlers.onFailure('unavailable', 'recognizer unavailable');
        return false;
      }
      const permission = await native.requestPermissionsAsync();
      if (!permission.granted) {
        handlers.onFailure('permission', 'microphone or speech recognition not allowed');
        return false;
      }
    } catch (error) {
      handlers.onFailure('unknown', error instanceof Error ? error.message : String(error));
      return false;
    }

    this.active = true;
    this.startedAt = this.now();
    this.lastSentenceAt = this.startedAt;
    this.restarts = 0;
    this.subscribe(native);
    this.startNative(native);
    this.timer = setInterval(() => this.tick(), 150);
    return true;
  }

  /** Close the session. Anything half-said is still handed over. */
  stop(why: 'stopped' | 'idle' | 'silent_start' = 'stopped') {
    if (!this.active) return;
    const tail = this.endpointer.flush();
    this.teardown();
    if (tail) this.handlers?.onUtterance(tail);
    this.handlers?.onLive('');
    this.handlers?.onEnded?.(why);
  }

  /** Close without handing over what was half-said. */
  abort() {
    if (!this.active) return;
    this.teardown();
    this.handlers?.onLive('');
    this.handlers?.onEnded?.('stopped');
  }

  private teardown() {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const sub of this.subs) sub.remove();
    this.subs = [];
    try {
      this.native?.abort();
    } catch {
      /* already stopped */
    }
  }

  private startNative(native: SpeechNative) {
    const onDevice = (() => {
      try {
        return native.supportsOnDeviceRecognition();
      } catch {
        return false;
      }
    })();
    native.start({
      lang: this.opts.locale ?? listenLocale(),
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      requiresOnDeviceRecognition: onDevice,
      addsPunctuation: false,
      contextualStrings: this.opts.vocabulary ?? [],
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 60_000,
      },
    });
  }

  private subscribe(native: SpeechNative) {
    const on = <T,>(event: string, fn: (payload: T) => void) =>
      this.subs.push(native.addListener(event, fn as (payload: never) => void));

    on<{ isFinal: boolean; results: Array<{ transcript: string }> }>('result', (event) => {
      if (!this.active) return;
      const transcript = event.results?.[0]?.transcript ?? '';
      const out = this.endpointer.feed(transcript, event.isFinal, this.now());
      this.handlers?.onLive(out.live);
      if (out.utterance) this.deliver(out.utterance);
    });

    on<{ value: number }>('volumechange', (event) => {
      // -2 … 10 from the recognizer; below 0 is silence.
      const level = Math.max(0, Math.min(1, event.value / 10));
      this.handlers?.onLevel?.(level);
    });

    on<{ error: string; message: string }>('error', (event) => {
      if (!this.active) return;
      const failure = failureFromNativeError(event.error);
      if (failure === 'ignore') return; // the 'end' that follows restarts us
      if (failure === 'interrupted' || failure === 'busy') return;
      this.teardown();
      this.handlers?.onLive('');
      this.handlers?.onFailure(failure, event.message || event.error);
      this.handlers?.onEnded?.('failure');
    });

    on<null>('end', () => {
      if (!this.active || this.restarting) return;
      // The recognizer ended on its own. Hand over what was said, then keep listening.
      const tail = this.endpointer.flush();
      if (tail) this.deliver(tail);
      this.endpointer.reset();
      this.restarts += 1;
      if (this.restarts > 40) {
        this.stop('idle');
        return;
      }
      this.restarting = true;
      setTimeout(() => {
        this.restarting = false;
        if (this.active && this.native) {
          try {
            this.startNative(this.native);
          } catch (error) {
            this.teardown();
            this.handlers?.onFailure('unknown', error instanceof Error ? error.message : String(error));
            this.handlers?.onEnded?.('failure');
          }
        }
      }, 120);
    });
  }

  private deliver(text: string) {
    this.lastSentenceAt = this.now();
    this.handlers?.onUtterance(text);
  }

  private tick() {
    if (!this.active) return;
    const now = this.now();
    const out = this.endpointer.tick(now);
    if (out.utterance) {
      this.handlers?.onLive('');
      this.deliver(out.utterance);
      return;
    }
    const keepOpen = this.opts.keepOpen?.() ?? false;
    if (keepOpen) {
      this.lastSentenceAt = now;
      return;
    }
    const silentStart = this.opts.silentStartMs ?? 12_000;
    if (!this.endpointer.heardAnything && now - this.startedAt > silentStart) {
      this.stop('silent_start');
      return;
    }
    const idle = this.opts.idleCloseMs ?? 30_000;
    const quiet = Math.min(now - this.lastSentenceAt, this.endpointer.quietFor(now) || Infinity);
    if (this.endpointer.heardAnything && !out.live && quiet > idle) {
      this.stop('idle');
    }
  }
}

/**
 * Base listener against a fake recognizer: sentences come out, restarts are invisible,
 * failures are named, silence closes the session, a live card keeps it open.
 */
import assert from 'node:assert/strict';

import {
  BaseListener,
  failureFromNativeError,
  listenLocale,
  setSpeechNativeForTests,
  vocabularyFor,
  type SpeechNative,
} from '@/lib/voice/base-listener';

type Listener = (payload: unknown) => void;

function fakeNative(opts?: { granted?: boolean; available?: boolean }) {
  const listeners = new Map<string, Set<Listener>>();
  const calls: string[] = [];
  const native: SpeechNative = {
    start: (o) => calls.push(`start:${String(o.lang)}:${String(o.continuous)}`),
    stop: () => calls.push('stop'),
    abort: () => calls.push('abort'),
    requestPermissionsAsync: async () => ({ granted: opts?.granted ?? true }),
    isRecognitionAvailable: () => opts?.available ?? true,
    supportsOnDeviceRecognition: () => true,
    addListener: (event, fn) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn as Listener);
      return { remove: () => listeners.get(event)!.delete(fn as Listener) };
    },
  };
  const emit = (event: string, payload: unknown) => {
    for (const fn of listeners.get(event) ?? []) fn(payload);
  };
  return { native, emit, calls };
}

async function main() {
  // A: sentences, live words, restart transparency.
  {
    const { native, emit, calls } = fakeNative();
    setSpeechNativeForTests(native);
    let now = 0;
    const listener = new BaseListener(() => now);
    const heard: string[] = [];
    const live: string[] = [];
    const ok = await listener.start(
      {
        onLive: (t) => live.push(t),
        onUtterance: (t) => heard.push(t),
        onFailure: () => assert.fail('no failure expected'),
      },
      { locale: 'en-CA', silenceMs: 1000 }
    );
    assert.equal(ok, true);
    assert.equal(calls[0], 'start:en-CA:true');
    const tick = () => (listener as unknown as { tick: () => void }).tick();

    emit('result', { isFinal: false, results: [{ transcript: 'clean the dishes' }] });
    now = 400;
    emit('result', { isFinal: false, results: [{ transcript: 'clean the dishes for Mia' }] });
    assert.equal(live.at(-1), 'clean the dishes for Mia');
    now = 1500;
    tick();
    assert.deepEqual(heard, ['clean the dishes for Mia']);

    // iOS ends the request on its own; the listener restarts and the next words are new.
    emit('end', null);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(calls.filter((c) => c.startsWith('start')).length, 2);
    now = 2000;
    emit('result', { isFinal: false, results: [{ transcript: 'and add milk' }] });
    now = 3200;
    tick();
    assert.deepEqual(heard, ['clean the dishes for Mia', 'and add milk']);

    // "no-speech" is not a failure.
    emit('error', { error: 'no-speech', message: '' });
    assert.equal(listener.active, true);

    listener.stop();
    assert.equal(listener.active, false);
  }

  // B: permission refused → named failure, never starts.
  {
    const { native, calls } = fakeNative({ granted: false });
    setSpeechNativeForTests(native);
    const listener = new BaseListener();
    let failure = '';
    const ok = await listener.start({
      onLive: () => undefined,
      onUtterance: () => undefined,
      onFailure: (reason) => {
        failure = reason;
      },
    });
    assert.equal(ok, false);
    assert.equal(failure, 'permission');
    assert.equal(calls.length, 0);
  }

  // C: a build without the module says so instead of throwing.
  {
    setSpeechNativeForTests(null);
    const listener = new BaseListener();
    let failure = '';
    await listener.start({
      onLive: () => undefined,
      onUtterance: () => undefined,
      onFailure: (reason) => {
        failure = reason;
      },
    });
    assert.equal(failure, 'unavailable');
  }

  // D: silence at the start closes the session; a live card holds it open.
  {
    const { native, emit } = fakeNative();
    setSpeechNativeForTests(native);
    let now = 0;
    let cardOnStage = true;
    const ends: string[] = [];
    const listener = new BaseListener(() => now);
    await listener.start(
      {
        onLive: () => undefined,
        onUtterance: () => undefined,
        onFailure: () => undefined,
        onEnded: (why) => ends.push(why),
      },
      { silentStartMs: 5000, idleCloseMs: 8000, keepOpen: () => cardOnStage }
    );
    const tick = () => (listener as unknown as { tick: () => void }).tick();
    now = 9000;
    tick();
    assert.equal(listener.active, true, 'a card on stage keeps listening open');
    cardOnStage = false;
    emit('result', { isFinal: true, results: [{ transcript: 'thanks' }] });
    now = 20_000;
    tick();
    assert.deepEqual(ends, ['idle']);
  }

  // E: a hard error ends with its reason.
  {
    const { native, emit } = fakeNative();
    setSpeechNativeForTests(native);
    const listener = new BaseListener();
    let failure = '';
    await listener.start({
      onLive: () => undefined,
      onUtterance: () => undefined,
      onFailure: (reason) => {
        failure = reason;
      },
    });
    emit('error', { error: 'language-not-supported', message: 'fr-BE' });
    assert.equal(failure, 'language');
    assert.equal(listener.active, false);
  }

  assert.equal(failureFromNativeError('no-speech'), 'ignore');
  assert.equal(failureFromNativeError('not-allowed'), 'permission');
  assert.equal(listenLocale('fr_CA'), 'fr-CA');
  assert.equal(listenLocale('de-DE'), 'en-US');
  assert.deepEqual(vocabularyFor(['Mia', 'mia', '', undefined, 'Noah']), ['Mia', 'Noah']);

  setSpeechNativeForTests(undefined);
  console.log('base-listener: ok');
  process.exit(0);
}

void main();

/** Tiny event bus for tour completion signals — Work Order 9 D3.3. */

import type { TourEventName } from '@/lib/tour/tour-types';

type Listener = (meta?: Record<string, unknown>) => void;

const listeners = new Map<TourEventName, Set<Listener>>();
const anyListeners = new Set<(e: TourEventName, meta?: Record<string, unknown>) => void>();

export type TourEvent = TourEventName;

export function emitTourEvent(e: TourEventName, meta?: Record<string, unknown>): void {
  const set = listeners.get(e);
  if (set) {
    for (const fn of set) {
      try {
        fn(meta);
      } catch (err) {
        console.warn('tour event listener failed', e, err);
      }
    }
  }
  for (const fn of anyListeners) {
    try {
      fn(e, meta);
    } catch (err) {
      console.warn('tour any-listener failed', e, err);
    }
  }
}

export function onTourEvent(e: TourEventName, fn: Listener): () => void {
  let set = listeners.get(e);
  if (!set) {
    set = new Set();
    listeners.set(e, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

export function onAnyTourEvent(fn: (e: TourEventName, meta?: Record<string, unknown>) => void): () => void {
  anyListeners.add(fn);
  return () => {
    anyListeners.delete(fn);
  };
}

/** Test helper — clears all listeners. */
export function __resetTourEventsForTests(): void {
  listeners.clear();
  anyListeners.clear();
}

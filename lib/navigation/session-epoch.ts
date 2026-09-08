import { useEffect, useState } from 'react';

/**
 * Bumped after sign-out / account deletion so the root navigator remounts
 * like a cold start. Replacing `/welcome` from a Settings modal otherwise
 * stacks Get Started on the still-mounted household tabs.
 */
let epoch = 0;
const listeners = new Set<() => void>();

export function getSessionEpoch(): number {
  return epoch;
}

export function bumpSessionEpoch(): number {
  epoch += 1;
  for (const listener of listeners) listener();
  return epoch;
}

export function subscribeSessionEpoch(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper — does not notify listeners (avoids leaking React updates). */
export function resetSessionEpochForTests(): void {
  epoch = 0;
  listeners.clear();
}

export function useSessionEpoch(): number {
  const [value, setValue] = useState(epoch);
  useEffect(() => subscribeSessionEpoch(() => setValue(getSessionEpoch())), []);
  return value;
}

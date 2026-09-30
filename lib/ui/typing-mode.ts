/**
 * "Someone is typing to Poppins" — shared so the tab bar can tighten while the chat is open,
 * whether or not the keyboard happens to be up at that moment.
 */
import { useSyncExternalStore } from 'react';

let typing = false;
const listeners = new Set<() => void>();

export function setPoppinsTypingMode(next: boolean): void {
  if (typing === next) return;
  typing = next;
  for (const listener of listeners) listener();
}

export function getPoppinsTypingMode(): boolean {
  return typing;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePoppinsTypingMode(): boolean {
  return useSyncExternalStore(subscribe, getPoppinsTypingMode, getPoppinsTypingMode);
}

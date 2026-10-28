/** Notify Settings / Credits when the credit bank changes after a buy or spend. */
const listeners = new Set<() => void>();

export function subscribeTokenGrantsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyTokenGrantsChanged(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Present the tour chapter picker from root — never nest a Modal under Settings.
 */
const listeners = new Set<(open: boolean) => void>();

export function subscribeTourChapterSheet(listener: (open: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openTourChapterSheet(): void {
  for (const listener of listeners) listener(true);
}

export function closeTourChapterSheet(): void {
  for (const listener of listeners) listener(false);
}

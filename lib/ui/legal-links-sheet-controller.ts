/** Present Privacy / Terms / Support from root — never nest Modal under Settings. */
const listeners = new Set<(open: boolean) => void>();

export function subscribeLegalLinksSheet(listener: (open: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openLegalLinksSheet(): void {
  for (const listener of listeners) listener(true);
}

export function closeLegalLinksSheet(): void {
  for (const listener of listeners) listener(false);
}

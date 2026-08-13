/** Keep a natural caption: never replace a longer line with a shorter partial. */

export function mergeTranscript(previous: string, next: string): string {
  const prev = previous.trim();
  const incoming = next.trim();
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming === prev) return prev;
  if (incoming.startsWith(prev) || prev.startsWith(incoming)) {
    return incoming.length >= prev.length ? incoming : prev;
  }
  if (prev.includes(incoming) && incoming.length < prev.length) return prev;
  return incoming;
}

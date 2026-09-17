/**
 * Closed-set fuzzy match (catalog + roster only — never free-text titles).
 * Edit distance ≤2 for words longer than 4 chars; require a clear margin.
 */

export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array<number>(t.length + 1);
  const cur = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = cur[j]!;
  }
  return prev[t.length]!;
}

export function maxEditDistance(word: string): number {
  return word.length > 4 ? 2 : word.length > 2 ? 1 : 0;
}

export type FuzzyHit<T> = {
  value: T;
  distance: number;
  /** 0–1; higher is better. */
  confidence: number;
};

/**
 * Pick the best closed-set candidate. Returns null on empty, no hit, or a near-tie
 * (two candidates within the same distance / confidence margin).
 */
export function bestFuzzyMatch<T>(
  needle: string,
  candidates: Array<{ key: string; value: T }>,
  opts?: { margin?: number }
): FuzzyHit<T> | null {
  const q = needle.trim().toLowerCase();
  if (!q || q.length < 2) return null;
  const maxDist = maxEditDistance(q);
  const scored: FuzzyHit<T>[] = [];
  for (const candidate of candidates) {
    const key = candidate.key.trim().toLowerCase();
    if (!key) continue;
    if (key === q) {
      scored.push({ value: candidate.value, distance: 0, confidence: 1 });
      continue;
    }
    // Prefer matching against whole key and each token of multi-word keys.
    const parts = [key, ...key.split(/\s+/).filter((p) => p.length >= 3)];
    let best = Number.POSITIVE_INFINITY;
    for (const part of parts) {
      const d = levenshtein(q, part);
      if (d < best) best = d;
    }
    if (best <= maxDist) {
      const confidence = Math.max(0, 1 - best / Math.max(q.length, 1));
      scored.push({ value: candidate.value, distance: best, confidence });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => a.distance - b.distance || b.confidence - a.confidence);
  const first = scored[0]!;
  const second = scored[1];
  const margin = opts?.margin ?? 0.12;
  if (second && second.distance === first.distance && first.confidence - second.confidence < margin) {
    return null; // near-tie → NARROW, do not guess
  }
  return first;
}

/** High-confidence enough to arm HOLD for consequential acts. */
export function isConfidentFuzzy(hit: FuzzyHit<unknown> | null | undefined): boolean {
  if (!hit) return false;
  if (hit.distance === 0) return true;
  return hit.confidence >= 0.72 && hit.distance <= 1;
}

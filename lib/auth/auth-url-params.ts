/** Parse query + hash params from a confirm / magic-link URL (pure — no Expo). */
export function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  for (const part of [query, hash]) {
    if (!part) continue;
    for (const pair of part.split('&')) {
      const [rawKey, rawValue = ''] = pair.split('=');
      if (!rawKey) continue;
      try {
        out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      } catch {
        out[rawKey] = rawValue;
      }
    }
  }
  return out;
}

export function urlHasAuthPayload(url: string | null | undefined): boolean {
  if (!url) return false;
  const p = paramsFromUrl(url);
  return Boolean(p.code || p.access_token || p.refresh_token || p.token_hash || p.token);
}

/**
 * Turn thrown values (Error, PurchaseError plain objects, FunctionsHttpError)
 * into a real string — never `[object Object]`.
 */
export function formatUnknownError(error: unknown, fallback = 'Something went wrong'): string {
  if (error == null) return fallback;
  if (typeof error === 'string') {
    const t = error.trim();
    return t && t !== '[object Object]' ? t : fallback;
  }
  if (error instanceof Error) {
    const msg = error.message?.trim();
    if (msg && msg !== '[object Object]') return msg;
    return fallback;
  }
  if (typeof error === 'object') {
    const row = error as Record<string, unknown>;
    for (const key of ['message', 'debugMessage', 'error', 'msg', 'reason'] as const) {
      const value = row[key];
      if (typeof value === 'string' && value.trim() && value.trim() !== '[object Object]') {
        return value.trim();
      }
    }
    if (typeof row.code === 'string' && row.code.trim()) {
      return row.code.trim();
    }
    try {
      const json = JSON.stringify(row);
      if (json && json !== '{}' && json !== 'null') {
        return json.length > 220 ? `${json.slice(0, 200)}…` : json;
      }
    } catch {
      /* ignore */
    }
  }
  const coerced = String(error);
  if (coerced && coerced !== '[object Object]') return coerced;
  return fallback;
}

import { chunkedRemoveItem, keysForChunkedValue, type KvBackend } from '@/lib/supabase/chunked-kv';
import { supabaseConfig } from '@/config/supabase-config';

/**
 * When true, SecureStore setItem for auth keys is a no-op. Stops an in-flight
 * token refresh on a dying GoTrue client from writing the JWT back after sign-out.
 */
let authStorageWritesBlocked = false;

export function isAuthStorageWritesBlocked(): boolean {
  return authStorageWritesBlocked;
}

export function blockAuthStorageWrites(): void {
  authStorageWritesBlocked = true;
}

export function allowAuthStorageWrites(): void {
  authStorageWritesBlocked = false;
}

export function isAuthStorageKey(key: string): boolean {
  return key.includes('auth-token') || key.startsWith('supabase.auth');
}

/** Same default GoTrue uses: `sb-<project-ref>-auth-token`. */
export function getAuthStorageKey(url = supabaseConfig.url): string {
  try {
    if (!url) return 'supabase.auth.token';
    const hostname = new URL(url).hostname;
    const ref = hostname.split('.')[0];
    if (!ref) return 'supabase.auth.token';
    return `sb-${ref}-auth-token`;
  } catch {
    return 'supabase.auth.token';
  }
}

export function persistedAuthKeys(storageKey = getAuthStorageKey()): string[] {
  return [
    ...keysForChunkedValue(storageKey),
    `${storageKey}-code-verifier`,
    `${storageKey}-user`,
    ...keysForChunkedValue(`${storageKey}-user`),
  ];
}

export async function wipePersistedAuthSession(
  backend: KvBackend,
  storageKey = getAuthStorageKey()
): Promise<void> {
  await chunkedRemoveItem(backend, storageKey);
  await chunkedRemoveItem(backend, `${storageKey}-user`);
  try {
    await backend.removeItem(`${storageKey}-code-verifier`);
  } catch {
    /* ignore */
  }
}

/**
 * Chunk large strings so they fit iOS SecureStore (~2048 bytes per value).
 * Supabase session JSON (JWT + user) is routinely larger than that.
 */

export const SECURE_STORE_CHUNK_CHARS = 1800;
export const CHUNK_COUNT_SUFFIX = '.chunks';
export const MAX_AUTH_CHUNKS = 32;

export type KvBackend = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function chunkCountKey(key: string): string {
  return `${key}${CHUNK_COUNT_SUFFIX}`;
}

export function chunkPieceKey(key: string, index: number): string {
  return `${key}.${index}`;
}

export function splitSecureStoreChunks(
  value: string,
  size = SECURE_STORE_CHUNK_CHARS
): string[] {
  if (size < 1) return [value];
  if (!value) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

export function joinSecureStoreChunks(chunks: string[]): string {
  return chunks.join('');
}

export function keysForChunkedValue(key: string, chunkCount = MAX_AUTH_CHUNKS): string[] {
  const keys = [key, chunkCountKey(key)];
  const n = Math.min(Math.max(chunkCount, 0), MAX_AUTH_CHUNKS);
  for (let i = 0; i < n; i++) {
    keys.push(chunkPieceKey(key, i));
  }
  return keys;
}

export async function chunkedGetItem(backend: KvBackend, key: string): Promise<string | null> {
  const countRaw = await backend.getItem(chunkCountKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  if (count > 0 && Number.isFinite(count)) {
    const pieces: string[] = [];
    const n = Math.min(count, MAX_AUTH_CHUNKS);
    for (let i = 0; i < n; i++) {
      const piece = await backend.getItem(chunkPieceKey(key, i));
      if (piece == null) return null;
      pieces.push(piece);
    }
    return joinSecureStoreChunks(pieces);
  }
  return backend.getItem(key);
}

export async function chunkedSetItem(
  backend: KvBackend,
  key: string,
  value: string
): Promise<void> {
  const chunks = splitSecureStoreChunks(value);
  if (chunks.length === 1) {
    await backend.setItem(key, chunks[0] ?? '');
    await removeChunkMetadata(backend, key);
    return;
  }

  for (let i = 0; i < chunks.length; i++) {
    await backend.setItem(chunkPieceKey(key, i), chunks[i] ?? '');
  }
  await backend.setItem(chunkCountKey(key), String(chunks.length));
  try {
    await backend.removeItem(key);
  } catch {
    /* legacy unchunked row may already be gone */
  }
}

export async function chunkedRemoveItem(backend: KvBackend, key: string): Promise<void> {
  let count = MAX_AUTH_CHUNKS;
  try {
    const countRaw = await backend.getItem(chunkCountKey(key));
    if (countRaw) {
      const parsed = Number.parseInt(countRaw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        count = Math.min(parsed + 2, MAX_AUTH_CHUNKS);
      }
    }
  } catch {
    /* delete a full spread below */
  }

  const keys = keysForChunkedValue(key, count);
  await Promise.all(
    keys.map(async (item) => {
      try {
        await backend.removeItem(item);
      } catch {
        /* missing key / native delete noise */
      }
    })
  );
}

async function removeChunkMetadata(backend: KvBackend, key: string): Promise<void> {
  try {
    const countRaw = await backend.getItem(chunkCountKey(key));
    const parsed = countRaw ? Number.parseInt(countRaw, 10) : 0;
    const n = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_AUTH_CHUNKS) : 0;
    const extras = [chunkCountKey(key), ...Array.from({ length: n }, (_, i) => chunkPieceKey(key, i))];
    await Promise.all(
      extras.map(async (item) => {
        try {
          await backend.removeItem(item);
        } catch {
          /* ignore */
        }
      })
    );
  } catch {
    /* ignore */
  }
}

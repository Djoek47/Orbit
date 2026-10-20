/**
 * Tiny on-device library of Playground / photo avatars.
 * Survives sign-out (AsyncStorage + documents/avatars) so You can re-pick a face.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAvatarImageUri } from '@/lib/game-levels';

const MAX_ENTRIES = 24;
const KEY_PREFIX = 'choremaxx.avatar-library.v1:';

export type AvatarLibraryEntry = {
  id: string;
  uri: string;
  createdAt: string;
  /** 'playground' | 'photos' | 'import' */
  source: 'playground' | 'photos' | 'import';
};

/** In-memory bank when AsyncStorage is unavailable (Node unit tests). */
const memoryBanks = new Map<string, AvatarLibraryEntry[]>();

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId.trim() || 'device'}`;
}

async function readAll(userId: string): Promise<AvatarLibraryEntry[]> {
  const key = keyFor(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return memoryBanks.get(key) ?? [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return memoryBanks.get(key) ?? [];
    return parsed.filter(
      (row): row is AvatarLibraryEntry =>
        Boolean(
          row &&
            typeof row === 'object' &&
            typeof (row as AvatarLibraryEntry).id === 'string' &&
            typeof (row as AvatarLibraryEntry).uri === 'string' &&
            isAvatarImageUri((row as AvatarLibraryEntry).uri)
        )
    );
  } catch {
    return memoryBanks.get(key) ?? [];
  }
}

async function writeAll(userId: string, entries: AvatarLibraryEntry[]): Promise<void> {
  const key = keyFor(userId);
  const next = entries.slice(0, MAX_ENTRIES);
  memoryBanks.set(key, next);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Node / missing native storage — memory bank still holds the gallery */
  }
}

export async function listAvatarLibrary(userId: string): Promise<AvatarLibraryEntry[]> {
  return readAll(userId);
}

export async function rememberAvatarInLibrary(input: {
  userId: string;
  uri: string;
  source?: AvatarLibraryEntry['source'];
}): Promise<AvatarLibraryEntry[]> {
  if (!isAvatarImageUri(input.uri)) return listAvatarLibrary(input.userId);
  const existing = await readAll(input.userId);
  const withoutDup = existing.filter((entry) => entry.uri !== input.uri);
  const next: AvatarLibraryEntry = {
    id: `av-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    uri: input.uri,
    createdAt: new Date().toISOString(),
    source: input.source ?? 'import',
  };
  const merged = [next, ...withoutDup].slice(0, MAX_ENTRIES);
  await writeAll(input.userId, merged);
  return merged;
}

/** Test helper — never call from product UI. */
export async function clearAvatarLibraryForTests(userId: string): Promise<void> {
  const key = keyFor(userId);
  memoryBanks.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

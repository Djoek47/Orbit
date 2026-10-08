import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  allowAuthStorageWrites,
  isAuthStorageKey,
  isAuthStorageWritesBlocked,
} from '@/lib/auth/auth-storage';
import { chunkedGetItem, chunkedRemoveItem, chunkedSetItem, type KvBackend } from '@/lib/supabase/chunked-kv';

/**
 * Supabase auth storage backed by chunked SecureStore on native and localStorage on web.
 *
 * iOS SecureStore warns (and may fail) above ~2048 bytes. A GoTrue session JSON is larger.
 * Native Keychain exceptions must stay JS Errors — never uncaught NSExceptions into Hermes.
 */
const nativeBackend: KvBackend = {
  async getItem(key: string) {
    try {
      return (await SecureStore.getItemAsync(key)) ?? null;
    } catch (error) {
      console.warn('secureStore.getItem', key, error);
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SecureStore.setItem failed for ${key}: ${message}`);
    }
  },
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('secureStore.removeItem', key, error);
    }
  },
};

const webBackend: KvBackend = {
  async getItem(key: string) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* quota / private mode */
    }
  },
  async removeItem(key: string) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function backend(): KvBackend {
  return Platform.OS === 'web' ? webBackend : nativeBackend;
}

export const secureStoreAdapter = {
  async getItem(key: string) {
    try {
      return await chunkedGetItem(backend(), key);
    } catch (error) {
      console.warn('secureStoreAdapter.getItem', key, error);
      return null;
    }
  },
  async setItem(key: string, value: string) {
    if (isAuthStorageWritesBlocked() && isAuthStorageKey(key)) {
      return;
    }
    await chunkedSetItem(backend(), key, value);
  },
  async removeItem(key: string) {
    try {
      await chunkedRemoveItem(backend(), key);
    } catch (error) {
      console.warn('secureStoreAdapter.removeItem', key, error);
    }
  },
};

/** Test / sign-in helper — same module so Metro keeps one write-block flag. */
export { allowAuthStorageWrites };

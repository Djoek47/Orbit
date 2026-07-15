import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase auth storage backed by SecureStore on native and localStorage on web.
 */
export const secureStoreAdapter = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }

    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignore quota / private mode
      }
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

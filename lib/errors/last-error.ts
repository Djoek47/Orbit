/**
 * Persist the last uncaught app error so Help can show it after a crash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'orbit.lastError.v1';

export type LastAppError = {
  message: string;
  stack?: string;
  componentStack?: string;
  at: string;
};

export async function saveLastAppError(error: LastAppError): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(error));
  } catch {
    /* ignore */
  }
}

export async function loadLastAppError(): Promise<LastAppError | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastAppError;
    if (!parsed?.message || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLastAppError(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
